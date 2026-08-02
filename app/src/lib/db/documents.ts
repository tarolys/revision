import { getDB } from "./schema";
import type { DocumentTemplate, DocumentFieldDraft, SubjectSlug } from "../types";
import { extractPlaceholderInfos } from "../document/placeholders";

export async function getAllTemplates(): Promise<DocumentTemplate[]> {
  const db = await getDB();
  return db.getAll("documentTemplates");
}

export async function getTemplate(id: string): Promise<DocumentTemplate | undefined> {
  const db = await getDB();
  return db.get("documentTemplates", id);
}

export async function getFieldDrafts(templateId: string): Promise<DocumentFieldDraft[]> {
  const db = await getDB();
  return db.getAllFromIndex("documentFieldDrafts", "templateId", templateId);
}

interface CreateTemplateInput {
  name: string;
  subject?: SubjectSlug;
  latexSource: string;
}

export async function createTemplate(input: CreateTemplateInput): Promise<DocumentTemplate> {
  const db = await getDB();
  const now = Date.now();
  const infos = extractPlaceholderInfos(input.latexSource);
  const template: DocumentTemplate = {
    id: crypto.randomUUID(),
    name: input.name,
    subject: input.subject,
    latexSource: input.latexSource,
    placeholders: infos.map((p) => p.name),
    paragraphFields: infos.filter((p) => p.isParagraph).map((p) => p.name),
    createdAt: now,
    updatedAt: now,
  };
  const tx = db.transaction(["documentTemplates", "documentFieldDrafts"], "readwrite");
  await tx.objectStore("documentTemplates").put(template);
  await Promise.all(
    template.placeholders.map((fieldName) =>
      tx.objectStore("documentFieldDrafts").put({
        templateId: template.id,
        fieldName,
        value: "",
        lastModified: now,
      }),
    ),
  );
  await tx.done;
  return template;
}

/** Re-scans latexSource and reconciles field drafts (spec §7.4 step 4): keep
 * drafts whose field is still present, drop drafts for removed fields,
 * create blank drafts for newly-appeared fields. */
export async function updateTemplateSource(
  templateId: string,
  latexSource: string,
): Promise<DocumentTemplate> {
  const db = await getDB();
  const existing = await db.get("documentTemplates", templateId);
  if (!existing) throw new Error(`Unknown template: ${templateId}`);

  const nextInfos = extractPlaceholderInfos(latexSource);
  const nextPlaceholders = nextInfos.map((p) => p.name);
  const now = Date.now();
  const updated: DocumentTemplate = {
    ...existing,
    latexSource,
    placeholders: nextPlaceholders,
    paragraphFields: nextInfos.filter((p) => p.isParagraph).map((p) => p.name),
    updatedAt: now,
  };

  const tx = db.transaction(["documentTemplates", "documentFieldDrafts"], "readwrite");
  await tx.objectStore("documentTemplates").put(updated);

  const draftsStore = tx.objectStore("documentFieldDrafts");
  const currentDrafts = await draftsStore.index("templateId").getAll(templateId);
  const currentNames = new Set(currentDrafts.map((d) => d.fieldName));
  const nextNames = new Set(nextPlaceholders);

  await Promise.all([
    ...currentDrafts
      .filter((d) => !nextNames.has(d.fieldName))
      .map((d) => draftsStore.delete([d.templateId, d.fieldName])),
    ...nextPlaceholders
      .filter((name) => !currentNames.has(name))
      .map((name) =>
        draftsStore.put({ templateId, fieldName: name, value: "", lastModified: now }),
      ),
  ]);
  await tx.done;
  return updated;
}

export async function saveFieldDraft(
  templateId: string,
  fieldName: string,
  value: string,
): Promise<void> {
  const db = await getDB();
  await db.put("documentFieldDrafts", {
    templateId,
    fieldName,
    value,
    lastModified: Date.now(),
  });
}

export async function deleteTemplate(templateId: string): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(["documentTemplates", "documentFieldDrafts"], "readwrite");
  await tx.objectStore("documentTemplates").delete(templateId);
  const drafts = await tx.objectStore("documentFieldDrafts").index("templateId").getAll(templateId);
  await Promise.all(drafts.map((d) => tx.objectStore("documentFieldDrafts").delete([d.templateId, d.fieldName])));
  await tx.done;
}
