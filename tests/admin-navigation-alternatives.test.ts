import assert from "node:assert/strict";
import test from "node:test";
import { adminNavigationItemsForPermissions, requiredAdminNavigationPermissions } from "../app/admin/navigation";

test("mail and support readers share route/API permission alternatives without granting mutation access", () => {
  for (const permission of ["communications.read", "mail.manage"]) {
    assert.ok(adminNavigationItemsForPermissions([permission]).some((item) => item.href === "/admin/mail-connections"));
    assert.deepEqual(requiredAdminNavigationPermissions("/admin/mail-connections", [permission]), []);
  }
  assert.ok(adminNavigationItemsForPermissions(["support.manage"]).some((item) => item.href === "/admin/support"));
  assert.equal(adminNavigationItemsForPermissions([]).length, 0);
  assert.deepEqual(requiredAdminNavigationPermissions("/admin/mail-connections", []), ["mail.read"]);
  assert.equal(requiredAdminNavigationPermissions("/admin/unregistered", ["mail.manage"]), null);
  assert.ok(!adminNavigationItemsForPermissions(["communications.read"]).some((item) => item.href === "/admin/staff"));
});
