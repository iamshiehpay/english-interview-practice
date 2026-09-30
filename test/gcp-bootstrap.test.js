import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const terraform=await readFile(new URL('../infra/bootstrap/main.tf',import.meta.url),'utf8');
const versions=await readFile(new URL('../infra/bootstrap/versions.tf',import.meta.url),'utf8');
const serviceTerraform=await readFile(new URL('../infra/service/main.tf',import.meta.url),'utf8');
const wizard=await readFile(new URL('../scripts/setup-gcp.sh',import.meta.url),'utf8');
const checksWorkflow=await readFile(new URL('../.github/workflows/checks.yml',import.meta.url),'utf8');

test('documentation-only changes do not trigger checks and a Cloud Run deployment',()=>{
  const pathBlocks=[...checksWorkflow.matchAll(/^    paths:\n((?:      - .+\n)+)/gm)].map(match=>match[1]);
  assert.equal(pathBlocks.length,1,'only main pushes define a path filter; the deployment chain starts from them');
  for(const block of pathBlocks){
    for(const required of ['.github/workflows/**','Dockerfile','src/**','public/**','demo/**','infra/**','test/**'])
      assert.match(block,new RegExp(`"${required.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}"`),`${required} changes must still run checks`);
    assert.doesNotMatch(block,/README\.md|CONTEXT\.md|AGENTS\.md|docs\/\*\*/,'documentation must not trigger the deployment chain');
  }
});

test('every pull request reports required-checks while documentation-only ones skip the heavy jobs',()=>{
  assert.match(checksWorkflow,/^  pull_request:\n  push:/m,'pull requests are not path-filtered, so the required check always reports');
  const pattern=checksWorkflow.match(/pattern='([^']+)'/)?.[1];
  assert.ok(pattern,'the changes job defines the relevant-path pattern');
  const relevant=new RegExp(pattern);
  for(const path of ['.github/workflows/checks.yml','Dockerfile','.dockerignore','package.json','src/server.js','public/app.js','demo/seed/workspace.json','evaluation/run.js','infra/service/main.tf','scripts/setup-gcp.sh','test/practice.test.js'])
    assert.match(path,relevant,`${path} changes must still run checks`);
  for(const path of ['README.md','CONTEXT.md','AGENTS.md','PORTFOLIO.md','docs/adr/0001.md','assets/portfolio/demo.gif'])
    assert.doesNotMatch(path,relevant,`${path} alone must not run the heavy jobs`);
  for(const job of ['test','container','terraform'])
    assert.match(checksWorkflow,new RegExp(`^  ${job}:\\n    needs: changes\\n    if: needs\\.changes\\.outputs\\.code == 'true'`,'m'),`${job} is gated on relevant changes`);
  const required=checksWorkflow.match(/^  required-checks:\n([\s\S]*)$/m)?.[1];
  assert.ok(required,'the required-checks aggregator job exists');
  assert.match(required,/if: always\(\)/,'the aggregator reports even when a needed job fails or is skipped');
  assert.match(required,/needs: \[changes, secrets, test, container, terraform\]/,'the aggregator waits for every job');
  assert.match(required,/success\|skipped\) ;;/,'only success and skipped results pass');
});

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

test('GCP session-count extraction uses the required distribution metric contract',()=>{
  const metric=serviceTerraform.match(/resource "google_logging_metric" "demo_sessions" \{([\s\S]*?)\n\}/)?.[1];
  assert.ok(metric,'demo session log metric is present');
  assert.match(metric,/metric_kind\s*=\s*"DELTA"/,'distribution log metrics must use DELTA');
  assert.match(metric,/value_type\s*=\s*"DISTRIBUTION"/,'a log value extractor requires a distribution metric');
  assert.match(metric,/value_extractor\s*=\s*"EXTRACT\(jsonPayload\.sessionCount\)"/,'session count is extracted from the structured log');
  assert.match(metric,/bucket_options\s*\{/,'distribution metric defines histogram buckets');
  assert.match(serviceTerraform,/title\s*=\s*"Observed active demo sessions \(p99\)"[\s\S]*?perSeriesAligner\s*=\s*"ALIGN_PERCENTILE_99"/,'the dashboard reduces the distribution to a numeric percentile');
});
