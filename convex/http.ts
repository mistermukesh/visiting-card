import { httpRouter } from "convex/server";
import { createAuth, registerRoutes } from "./auth";

const http = httpRouter();

registerRoutes(http, createAuth);

export default http;
