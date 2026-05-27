# Playbook CSVs

Place the uploaded AVERON playbook datasets in this folder with their original
file names:

- `ai_objections_rows.csv`
- `ai_emotional_intelligence_rules_rows.csv`
- `ai_personality_branches_rows.csv`
- `ai_sales_stages_rows.csv`
- `ai_deal_stages_rows.csv`
- `ai_stage_detection_rules_rows.csv`
- `ai_state_engine_rules_rows.csv`
- `ai_memory_rules_rows.csv`
- `ai_memory_blocks_rows.csv`
- `knowledge_base_rows.csv`

Runtime loading is lazy and cached. Missing files are treated as empty datasets,
with the legacy objection fallback preserved for rollback safety.
