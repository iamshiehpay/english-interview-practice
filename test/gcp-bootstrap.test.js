import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const terraform=await readFile(new URL('../infra/bootstrap/main.tf',import.meta.url),'utf8');
const versions=await readFile(new URL('../infra/bootstrap/versions.tf',import.meta.url),'utf8');
const wizard=await readFile(new URL('../scripts/setup-gcp.sh',import.meta.url),'utf8');

test('GCP bootstrap keeps the WIF provider display name within the API limit',()=>{
  const provider=terraform.match(/resource "google_iam_workload_identity_pool_provider" "github" \{([\s\S]*?)\n\}/)?.[1];
  assert.ok(provider,'WIF provider resource is present');
  const displayName=provider.match(/display_name\s*=\s*"([^"]+)"/)?.[1];
  assert.ok(displayName,'WIF provider has a display name');
  assert.ok(!displayName.includes('${'),'WIF display name must not grow with repository or branch input');
  assert.ok(displayName.length<=32,`WIF display name is ${displayName.length} characters; GCP allows 32`);
});

test('GCP wizard assigns the selected project as the ADC quota project before planning',()=>{
  const selected=wizard.indexOf('gcloud config set project "$PROJECT_ID"');
  const quota=wizard.indexOf('gcloud auth application-default set-quota-project "$PROJECT_ID"');
  const plan=wizard.indexOf('terraform -chdir=infra/bootstrap plan');
  assert.ok(selected>=0,'wizard selects the GCP project');
  assert.ok(quota>selected,'wizard sets ADC quota project after selecting the project');
  assert.ok(plan>quota,'wizard sets ADC quota project before Terraform plan/apply');
});

test('GCP bootstrap bills quota-bearing API requests to the selected project',()=>{
  assert.match(versions,/billing_project\s*=\s*var\.project_id/,'provider assigns the selected project as its billing project');
  assert.match(versions,/user_project_override\s*=\s*true/,'provider sends the billing project with quota-bearing requests');
});

test('GCP budget uses the billing account currency instead of a hard-coded currency',()=>{
  const budget=terraform.match(/resource "google_billing_budget" "project" \{([\s\S]*)/)?.[1];
  assert.ok(budget,'billing budget resource is present');
  assert.doesNotMatch(budget,/currency_code\s*=/,'Budget API must infer the linked billing account currency');
  assert.match(budget,/units\s*=\s*"1"/,'budget keeps the one-unit early warning amount');
});
