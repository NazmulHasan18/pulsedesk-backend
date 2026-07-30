import { Router } from "express";
import auth, { Permission } from "../../middlewares/auth";
import validateRequest from "../../middlewares/validateRequest";
import { FaqController } from "./faq.controller";
import { FaqValidation } from "./faq.validation";

const router = Router();

// ---------------------------------------------------------------------------
// Categories — content management is ADMIN-only, both roles can read.
// ---------------------------------------------------------------------------
router.post(
  "/categories",
  auth(Permission.agentAdmin),
  validateRequest(FaqValidation.createFaqCategory),
  FaqController.createCategory,
);
router.get("/categories", auth(Permission.agent), FaqController.getCategories);
router.get("/categories/:id", auth(Permission.agent), FaqController.getCategory);
router.patch(
  "/categories/:id",
  auth(Permission.agentAdmin),
  validateRequest(FaqValidation.updateFaqCategory),
  FaqController.updateCategory,
);
router.delete("/categories/:id", auth(Permission.agentAdmin), FaqController.deleteCategory);

// ---------------------------------------------------------------------------
// Docs — /docs/search must stay above /docs/:id to avoid the id route
// swallowing the literal "search" segment.
// ---------------------------------------------------------------------------
router.post(
  "/docs",
  auth(Permission.agentAdmin),
  validateRequest(FaqValidation.createFaqDoc),
  FaqController.createDoc,
);
router.get("/docs", auth(Permission.agent), FaqController.getDocs);
router.get(
  "/docs/search",
  auth(Permission.agent),
  validateRequest(FaqValidation.searchFaqDocs),
  FaqController.searchDocs,
);
router.get("/docs/:id", auth(Permission.agent), FaqController.getDoc);
router.patch(
  "/docs/:id",
  auth(Permission.agentAdmin),
  validateRequest(FaqValidation.updateFaqDoc),
  FaqController.updateDoc,
);
router.delete("/docs/:id", auth(Permission.agentAdmin), FaqController.deleteDoc);

export const FaqRoutes = router;
