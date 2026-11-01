// Entry point for the flowlytix-money Worker (wrangler.jsonc "main").
// default = the public site and API (worker/index.js).
// Admin = a PRIVATE entrypoint: only Workers given a service binding to it can call it (support.flowlytix.co, binding MONEY).
// It has no web address, so nobody on the internet can reach it. The support site checks the owner's admin password first.
// Tests import worker/index.js and worker/admin.js directly (this file needs the Workers runtime).
import { WorkerEntrypoint } from "cloudflare:workers";
import worker from "./index.js";
import { adminFetch } from "./admin.js";

export default worker;

export class Admin extends WorkerEntrypoint {
  fetch(request) { return adminFetch(request, this.env); }
}
