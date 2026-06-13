# Claude Harness Benchmark Sources

This document records the public sources benchmarked before creating this project's `CLAUDE.md` and `.claude/skills/*` files.

GitHub does not provide a single formal "positive review" score. For this benchmark, selection used public proxies: GitHub stars, forks, official ownership, community curation, visible discussions/issues, and direct relevance to Claude Code `CLAUDE.md`, skills, agents, hooks, and harness-style workflows.

## Benchmarked Repositories

| Repository | Why It Was Benchmarked | Patterns Borrowed |
|---|---|---|
| `anthropics/skills` | Official Agent Skills reference repository with high stars/forks and the canonical `SKILL.md` structure. | Skill frontmatter, self-contained skill folders, progressive disclosure. |
| `shanraisshan/claude-code-best-practice` | Large Claude Code best-practice reference with working `.claude/` examples, workflows, skills, hooks, and CLAUDE.md examples. | Keep CLAUDE.md concise, use project skills for specialized workflows, inspect-plan-execute-review workflow. |
| `hesreallyhim/awesome-claude-code` | Highly starred curated Claude Code ecosystem list covering skills, hooks, slash commands, orchestrators, apps, plugins, and CLAUDE.md resources. | Use curated ecosystem patterns, keep references discoverable, favor quality/security/originality. |
| `wshobson/agents` | Large Claude Code orchestration/plugin/skill repository emphasizing focused plugins, specialized agents, workflow orchestrators, commands, and progressive disclosure. | Single-purpose skills, minimal token loading, composable workflow boundaries. |
| `davila7/claude-code-templates` | Popular Claude Code template/configuration repository with agents, commands, settings, hooks, integrations, project templates, and attribution practices. | Reusable project configuration, explicit component cataloging, source attribution discipline. |

## Additional Official Guidance

| Source | Patterns Borrowed |
|---|---|
| Claude Code official best practices | Verify work with tests/builds, explore before plan before code, keep `CLAUDE.md` short, use skills for domain-specific workflows, configure hooks for deterministic checks. |
