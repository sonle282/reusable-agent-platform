import { describe, expect, it } from "vitest";
import { allows, requiredRole, type Role } from "../src/worker/users";

const can = (role: Role, method: string, path: string) => allows(role, requiredRole(method, path));
const conv = "/api/admin/conversations/agent_1%3Aconn_1%3Auser_1";

describe("who may call which admin API", () => {
  it("staff: Home, Leads, Conversations and their own account", () => {
    for (const [method, path] of [
      ["GET", "/api/admin/bootstrap"], ["GET", "/api/admin/dashboard"], ["GET", "/api/admin/agents/a1/attention"],
      ["POST", "/api/admin/attention/dismiss"], ["GET", "/api/admin/conversations"], ["GET", conv], ["POST", `${conv}/takeover`],
      ["GET", "/api/admin/leads"], ["GET", "/api/admin/leads/l1"], ["PATCH", "/api/admin/leads/l1"],
      ["GET", "/api/admin/me"], ["PATCH", "/api/admin/me"], ["POST", "/api/admin/me/password"], ["POST", "/api/admin/me/email"], ["POST", "/api/admin/logout"],
    ]) expect(can("staff", method, path), `${method} ${path}`).toBe(true);
  });

  it("staff can't touch assistants, Data, customer data, channels, settings or users", () => {
    for (const [method, path] of [
      ["GET", "/api/admin/agents/a1"], ["PATCH", "/api/admin/agents/a1"], ["POST", "/api/admin/agents/a1/publish"], ["POST", "/api/admin/agents/a1/preview"],
      ["PATCH", "/api/admin/collections/c1/records/r1"], ["POST", "/api/admin/images"], ["POST", "/api/admin/fixes/f1/apply"],
      ["GET", "/api/admin/leads/export.csv"], ["DELETE", "/api/admin/leads/l1"], ["POST", `${conv}/erase`], ["GET", `${conv}/customer-data`],
      ["GET", "/api/admin/connections"], ["PUT", "/api/admin/settings/anthropic"], ["GET", "/api/admin/users"], ["POST", "/api/admin/users/invites"],
    ]) expect(can("staff", method, path), `${method} ${path}`).toBe(false);
  });

  it("managers run assistants, Data and customer data, but not channels, settings, users or deleting an assistant", () => {
    for (const [method, path] of [["PATCH", "/api/admin/agents/a1"], ["POST", "/api/admin/agents/a1/publish"], ["POST", "/api/admin/agents/a1/rollback/v1"], ["POST", "/api/admin/agents"], ["POST", "/api/admin/collections/c1/import"], ["POST", "/api/admin/images"], ["POST", `${conv}/erase`], ["GET", "/api/admin/leads/export.csv"], ["POST", "/api/admin/deliveries/d1/retry"]])
      expect(can("manager", method, path), `${method} ${path}`).toBe(true);
    for (const [method, path] of [["DELETE", "/api/admin/agents/a1"], ["POST", "/api/admin/agents/a1/tools"], ["GET", "/api/admin/connections"], ["PATCH", "/api/admin/connections/c1"], ["POST", "/api/admin/zernio/accounts"], ["PATCH", "/api/admin/settings/brand"], ["GET", "/api/admin/export"], ["GET", "/api/admin/users"], ["POST", "/api/admin/users/u1/reset-link"]])
      expect(can("manager", method, path), `${method} ${path}`).toBe(false);
  });

  it("owners can do everything, and a route nobody listed needs an owner", () => {
    expect(can("owner", "DELETE", "/api/admin/users/u1")).toBe(true);
    expect(requiredRole("POST", "/api/admin/something-new")).toBe("owner");
    expect(requiredRole("GET", "/api/admin/agents-archive")).toBe("owner");
  });
});
