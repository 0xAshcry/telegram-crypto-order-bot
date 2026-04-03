import express from "express";
import cors from "cors";
import path from "path";
import { router } from "./routes";

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));
app.use("/admin-assets", express.static(path.join(process.cwd(), "public", "admin")));
app.get("/admin", (_req, res) => {
  res.sendFile(path.join(process.cwd(), "public", "admin", "index.html"));
});
app.use("/api", router);

export default app;
