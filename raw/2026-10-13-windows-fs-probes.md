# Capture: Windows filesystem probes behind audit-core#19

Captured 2026-10-13 against `GenvidTechnologies/audit-core` branch
`fix/walk-symlinks-stat-failures` at `fa2dd72`. These are the measurements
behind issue #19 (`walkComponents` silently skips components whose `stat`
fails or that are symlinks). The wiki pages `windows-fs-semantics.md` and
`component-read-error.md` cite this file.

Environment: Windows 11 Pro 10.0.26200, Node v24.11.1, Developer Mode on
(`AllowDevelopmentWithoutDevLicense=1`), process **not** elevated. Fixtures
were built under `realpathSync.native(os.tmpdir())` and removed afterwards.
Nothing here was run on Linux or macOS.

The four probe scripts lived in the session scratchpad. They are summarised
below rather than copied; their outputs are quoted verbatim from a re-run at
`fa2dd72`, which already carries the #19 fix. So the `walkComponents`
sections show the **fixed** walker, and in `design19-run` the "current" and
"proto" lines agree. The pre-fix walk over the same `probe19` fixture,
measured at `e10b795` during the #19 analysis, returned only `innerlink`,
`real` and `realagent`: every other entry was dropped silently.

## Probe scripts

* `probe19.mjs`: builds a plugin fixture with a real skill dir, a `'dir'`
  symlink, a `'junction'`, a dangling dir symlink, a dangling junction, a
  file-symlinked agent, a dangling agent link, a dir symlink named `x.md`, a
  `SKILL.md` file symlink inside a real dir, a dangling `SKILL.md` symlink,
  and a `SKILL.md` → `B.md` → `SKILL.md` symlink loop. It then prints each
  entry's `Dirent` type answers, `stat` and `lstat` results, `stat` on each
  `SKILL.md` path, a path through a regular file, a dangling `skills/` tree
  (`plugin3`), and `walkComponents` output.
* `probe19b.mjs`: uses `icacls /deny <user>:(F)` on one `SKILL.md`, and
  `/deny <user>:(RD,X,RA)` on another skill's directory, then reports `stat`,
  `readFile`, `fileExists` and `walkComponents` for each. The deny entries
  are removed (`icacls /remove:d`) before cleanup.
* `probe19c.mjs`: a `node --test` file that mocks `promises.stat` with
  `t.mock.method` to throw `EACCES` and checks that `fileExists` sees it,
  i.e. that the `promises`-object mock seam reaches the library.
* `design19-run.mjs`: compares the design prototype walker with the repo's
  walker over a similar fixture, plus a dangling `skills/` link, a `skills`
  regular file, a plugin root that is a file, and a missing root.

## Output: probe19.mjs

```text
== creation
skill dir symlink (dir) | created
skill junction | created
skill dangling dir symlink | created
skill dangling junction | created
agent file symlink | created
agent dangling file symlink | created
agent dir symlink named x.md | created
SKILL.md file symlink inside real dir | created
dangling SKILL.md symlink inside real dir | created
SKILL.md symlink loop (SKILL.md->B.md->SKILL.md) | created
== readdir Dirent
skills/dangdir | isDirectory=false isFile=false isSymbolicLink=true | stat=ERR ENOENT | lstat=symlink
skills/dangjunc | isDirectory=false isFile=false isSymbolicLink=true | stat=ERR ENOENT | lstat=symlink
skills/innerdang | isDirectory=true isFile=false isSymbolicLink=false | stat=dir | lstat=dir
skills/innerlink | isDirectory=true isFile=false isSymbolicLink=false | stat=dir | lstat=dir
skills/junc | isDirectory=false isFile=false isSymbolicLink=true | stat=dir | lstat=symlink
skills/loop | isDirectory=true isFile=false isSymbolicLink=false | stat=dir | lstat=dir
skills/real | isDirectory=true isFile=false isSymbolicLink=false | stat=dir | lstat=dir
skills/symdir | isDirectory=false isFile=false isSymbolicLink=true | stat=dir | lstat=symlink
agents/dangagent.md | isDirectory=false isFile=false isSymbolicLink=true | stat=ERR ENOENT | lstat=symlink
agents/dirlink.md | isDirectory=false isFile=false isSymbolicLink=true | stat=dir | lstat=symlink
agents/realagent.md | isDirectory=false isFile=true isSymbolicLink=false | stat=file | lstat=file
agents/symagent.md | isDirectory=false isFile=false isSymbolicLink=true | stat=file | lstat=symlink
== stat on SKILL.md paths
skills/real/SKILL.md stat=file fileExists=true
skills/innerlink/SKILL.md stat=file fileExists=true
skills/innerdang/SKILL.md stat=ERR ENOENT fileExists=false
skills/loop/SKILL.md stat=ERR ELOOP fileExists=false
skills/symdir/SKILL.md stat=file fileExists=true
skills/junc/SKILL.md stat=file fileExists=true
skills/dangdir/SKILL.md stat=ERR ENOENT fileExists=false
skills/dangjunc/SKILL.md stat=ERR ENOENT fileExists=false
path through a file: stat=ERR ENOENT fileExists=false dirExists=false
plugin3/skills (dangling) stat=ERR ENOENT dirExists=false
== walkComponents(plugin)
{"type":"skill","name":"dangdir","readError":"ENOENT","fmName":null}
{"type":"skill","name":"dangjunc","readError":"ENOENT","fmName":null}
{"type":"skill","name":"innerdang","readError":"ENOENT","fmName":null}
{"type":"skill","name":"innerlink","readError":null,"fmName":"linked"}
{"type":"skill","name":"junc","readError":null,"fmName":"linked"}
{"type":"skill","name":"loop","readError":"ELOOP","fmName":null}
{"type":"skill","name":"real","readError":null,"fmName":"real"}
{"type":"skill","name":"symdir","readError":null,"fmName":"linked"}
{"type":"agent","name":"dangagent","readError":"ENOENT","fmName":null}
{"type":"agent","name":"realagent","readError":null,"fmName":"realagent"}
{"type":"agent","name":"symagent","readError":null,"fmName":"agentlinked"}
== walkComponents(plugin3) count=1
```

## Output: probe19b.mjs

```text
deny file (F): ok
deny dir traverse/list on lockeddir: ok
\plugin\skills\locked\SKILL.md stat=ok isFile=true readFile=ERR EPERM fileExists=true
\plugin\skills\lockeddir\SKILL.md stat=ok isFile=true readFile=ok fileExists=true
{"name":"locked","readError":"EPERM"}
{"name":"lockeddir","readError":null}
cleaned
```

## Output: probe19c.mjs

```text
before mock=true with EACCES mock=false
✔ stat seam (13.0708ms)
ℹ tests 1
ℹ suites 0
ℹ pass 1
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 34.8387
```

## Output: design19-run.mjs

```text
== plugin
 current: ["skill dangdir ENOENT ","skill dangjunc ENOENT ","skill innerdang ENOENT ","skill innerlink  linked","skill junc  linked","skill loop ELOOP ","skill real  real","skill symdir  linked","agent dangagent ENOENT ","agent realagent  realagent","agent symagent  agentlinked"]
 proto:   ["skill dangdir ENOENT ","skill dangjunc ENOENT ","skill innerdang ENOENT ","skill innerlink  linked","skill junc  linked","skill loop ELOOP ","skill real  real","skill symdir  linked","agent dangagent ENOENT ","agent realagent  realagent","agent symagent  agentlinked"]
== plugin3 dangling skills/
 current: ["skill skills/ ENOENT "]
 proto:   ["skill skills/ ENOENT "]
== plugin4 skills is a file
 current: []
 proto:   []
== plugin5 root is a file
 current: []
 proto:   []
== missing root
 current: []
 proto:   []
```
