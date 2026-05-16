# Skills

Morlob ships workspace skills for external agents that need to use Morlob as durable shared state.

## OpenClaw Todos

The first OpenClaw skill lives at:

```text
skills/openclaw-morlob-todos/SKILL.md
```

The public URL is:

```text
https://www.morlob.com/skills/openclaw-morlob-todos/SKILL.md
```

It teaches OpenClaw how to use the production Morlob REST API at:

```text
https://www.morlob.com
```

Supported todo operations:

- list todos
- create a todo
- complete a todo
- delete a todo

Required OpenClaw runtime inputs:

- `MORLOB_AGENT_API_KEY`
- `MORLOB_ORG_ID`
- `MORLOB_WORKSPACE_ID`

The agent API key must include `todos:read` for listing and `todos:write` for mutations, and the agent must be assigned to the target workspace.

OpenClaw loads skills from `<workspace>/skills/`, so the skill can be used directly from this repository workspace. To verify it is visible to OpenClaw:

```bash
openclaw skills list
```

Start a fresh OpenClaw session after adding or changing skills:

```bash
openclaw gateway restart
```

or start a new chat session with:

```text
/new
```
