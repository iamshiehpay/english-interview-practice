// Exact provider JSON shape; domain validation additionally checks source grounding.
const text={type:'string',minLength:1};
const object=properties=>({type:'object',properties,required:Object.keys(properties),additionalProperties:false});
const list=items=>({type:'array',items,minItems:1});
const category={type:'string',enum:['role-fit','experience-depth','behavioral','technical-communication']};
const capability=object({id:text,description:text,evidence:text,kind:{type:'string',enum:['fact','inference']}});
const legacyQuestion=object({id:text,text,rationale:text,category,capabilityIds:list(text),evidence:text});
const bilingualQuestion=object({id:text,text,meaningZh:text,rationale:text,rationaleZh:text,category,capabilityIds:list(text),evidence:text});
export const analysisSchema=object({
  capabilities:list(capability),
  questions:list(bilingualQuestion)
});
export const additionalAnalysisSchema=object({capabilities:list(capability),questions:list({oneOf:[legacyQuestion,bilingualQuestion]})});
const rating=object({level:{type:'integer',minimum:1,maximum:4},quote:text,reason:text,reasonZh:text});
const finding=object({text,textZh:text,quote:text});
export const feedbackSchema=object({ratings:object({relevance:rating,support:rating,structure:rating,englishExpression:rating}),strength:finding,priorityImprovement:finding});

export const coachingSchema=object({text,explanationZh:text});
export const followUpSchema=object({text,meaningZh:text});
