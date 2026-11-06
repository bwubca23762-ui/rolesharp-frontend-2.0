import test from "node:test";
import assert from "node:assert/strict";
import { TOOLS } from "../lib/tools-registry";
import { TOOL_WORKSPACES, toolWorkspaceForPath } from "../lib/tool-workspaces";

test("every catalogue tool belongs to exactly one workspace and keeps its route", () => {
  assert.equal(TOOL_WORKSPACES.length, 6);
  for (const tool of TOOLS) {
    assert.equal(TOOL_WORKSPACES.filter((workspace) => (workspace.paths as readonly string[]).includes(tool.href)).length, 1, tool.href);
    assert.ok(toolWorkspaceForPath(tool.href));
  }
  assert.equal(toolWorkspaceForPath("/jobs/india?sort=recent")?.id, "fit");
  assert.equal(toolWorkspaceForPath("/resume-maker/")?.id, "resume");
  assert.equal(toolWorkspaceForPath("/interview-questions/software-engineer")?.id, "interview");
  assert.equal(toolWorkspaceForPath("/settings"), undefined);
  assert.equal(toolWorkspaceForPath("/jobs-malicious"), undefined);
});

test("cover-letter catalogue access agrees with the existing Premium gates", () => {
  assert.equal(TOOLS.find((tool) => tool.href === "/cover-letter-analyzer")?.premium, true);
  assert.equal(TOOLS.find((tool) => tool.href === "/cover-letter-generator")?.premium, true);
});
