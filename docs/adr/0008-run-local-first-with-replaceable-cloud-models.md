# Run local-first with replaceable cloud models

The MVP will run as a Local Workspace without user accounts or a hosted application database. Job data, transcripts, feedback, and progress remain locally controlled, while speech transcription and language-model inference may use explicitly configured external providers and user-supplied credentials. Provider boundaries will remain replaceable so fully local inference can be added later without making offline model deployment an MVP dependency.
