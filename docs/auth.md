# Authentication and Signup Approval

Morlob uses Supabase Auth for human users.

## Signup Flow

Users create accounts through:

```text
POST /api/auth/signup
```

The server creates the Supabase Auth user with `SUPABASE_SECRET_KEY`, then writes access state to `public.user_access`.

Signup outcomes:

- If the email exists in `public.signup_allowlist`, the user is approved automatically.
- If the email is not allowlisted, the user is created with `pending` access.
- Pending and rejected users cannot enter `/app`.
- Approved platform admins can approve or reject pending users from the dashboard.

The bootstrap signup migration seeds:

```text
mail@sserrano.com
```

as an allowlisted platform admin.

## Production Requirement

Disable direct public signup in Supabase Auth for production. Morlob's approval model depends on users signing up through `/api/auth/signup`; direct Supabase signup would bypass the pending-approval gate.

## Tables

### `signup_allowlist`

Emails in this table are auto-approved at signup.

Important columns:

```text
email
is_platform_admin
created_at
```

### `user_access`

Tracks access status for Supabase Auth users.

Statuses:

```text
pending
approved
rejected
```

Important columns:

```text
user_id
email
status
is_platform_admin
approved_by
approved_at
rejected_by
rejected_at
```

## Admin APIs

List pending signup requests:

```text
GET /api/admin/signup-requests
```

Approve or reject:

```text
PATCH /api/admin/signup-requests/:request_id
```

Body:

```json
{
  "status": "approved"
}
```

or:

```json
{
  "status": "rejected"
}
```
