---
description: Load a named editing playbook from the running SlopStudio server. Usage /playbook <name>  (interview-cleanup, scene-highlight, vertical-repurpose, music-montage, assembly-from-transcript, delivery-verify, director-style, film-dialogue, trailer-construction, typography-and-motion, preproduction)
---
Call `get_playbook` with `name: "$1"` on the slopstudio MCP server and read it in full before doing anything else. Then summarise in a few lines what the playbook requires for the current job, and follow it, together with `guide/RULES.md`, for the rest of this task.
