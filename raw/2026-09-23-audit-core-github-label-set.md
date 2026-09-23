# Capture: audit-core GitHub label set

Captured 2026-09-23 from `GenvidTechnologies/audit-core` via the GitHub CLI.
This is the evidence behind choosing the **flat** triage-template variant: the
repo carries GitHub's nine default labels and no `type:` / `priority/` / `area:`
prefixed label, which is the documented discriminator in
`/gvt-dev:triage-issues` §0b.

Command:

    gh label list --json name -L 200

Output (9 labels, well under the -L 200 cap, so the listing is complete rather
than truncated):

    bug
    documentation
    duplicate
    enhancement
    good first issue
    help wanted
    invalid
    question
    wontfix

Note: `triaged` is absent from this capture. It was created later the same day
(`gh label create triaged --description "Triage complete" --color 0e8a16`) to
satisfy the `bugTracker.triagedLabel` key. `needs-info` is also absent and was
deliberately not created — the flat variant reuses `question` for that role.
