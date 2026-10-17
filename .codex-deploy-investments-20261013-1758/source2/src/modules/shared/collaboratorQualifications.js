const db = require("../../config/db");

const hasCollaboratorQualificationsTable = async () => {
  const { rows } = await db.query(
    `SELECT to_regclass('public.collaborator_qualifications') AS table_name`,
  );
  return Boolean(rows[0]?.table_name);
};

const resolveQualificationTypeFromLegacy = (
  credentialType,
  metadata = {},
) => {
  const normalizedCredentialType = String(credentialType || "")
    .trim()
    .toLowerCase();
  const normalizedMetadataType = String(metadata?.qualification_type || "")
    .trim()
    .toLowerCase();
  const normalizedTitleLevel = String(
    metadata?.nivel_titulo ||
      metadata?.education_level ||
      metadata?.degree_level ||
      "",
  )
    .trim()
    .toLowerCase();

  if (
    [
      "third_level_title",
      "fourth_level_title",
      "certification",
      "senescyt_record",
    ].includes(normalizedMetadataType)
  ) {
    return normalizedMetadataType;
  }

  if (
    ["certification", "course", "diploma", "other"].includes(
      normalizedCredentialType,
    )
  ) {
    return "certification";
  }

  if (normalizedCredentialType === "title") {
    if (
      normalizedTitleLevel.includes("tercer") ||
      normalizedTitleLevel.includes("3")
    ) {
      return "third_level_title";
    }
    if (
      normalizedTitleLevel.includes("cuarto") ||
      normalizedTitleLevel.includes("4")
    ) {
      return "fourth_level_title";
    }
  }

  return null;
};

const buildEmptySummary = () => ({
  total: 0,
  active: 0,
  expired: 0,
  expiring_soon: 0,
  certifications_total: 0,
  third_level_titles_total: 0,
  fourth_level_titles_total: 0,
  senescyt_records_total: 0,
});

const buildSummaryFromRows = (rows = []) => {
  return rows.reduce((summary, row) => {
    const type = String(row.qualification_type || "").trim();
    const expiryDate = row.expiry_date ? new Date(row.expiry_date) : null;
    const hasValidExpiry = expiryDate && !Number.isNaN(expiryDate.getTime());
    const daysUntilExpiry = hasValidExpiry
      ? Math.ceil((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      : null;

    summary.total += 1;
    if (type === "certification") summary.certifications_total += 1;
    if (type === "third_level_title") summary.third_level_titles_total += 1;
    if (type === "fourth_level_title") summary.fourth_level_titles_total += 1;
    if (type === "senescyt_record") summary.senescyt_records_total += 1;

    if (!hasValidExpiry) {
      summary.active += 1;
    } else if (daysUntilExpiry < 0) {
      summary.expired += 1;
    } else if (daysUntilExpiry <= 30) {
      summary.expiring_soon += 1;
    } else {
      summary.active += 1;
    }

    return summary;
  }, buildEmptySummary());
};

const summarizeQualificationsByUserIds = async (userIds = []) => {
  const normalizedUserIds = [...new Set(userIds.map(Number).filter(Boolean))];
  if (!normalizedUserIds.length) return new Map();
  if (!(await hasCollaboratorQualificationsTable())) return new Map();

  const { rows } = await db.query(
    `SELECT
        id,
        user_id,
        qualification_type,
        expiry_date
     FROM collaborator_qualifications
     WHERE user_id = ANY($1::int[])
       AND is_active = true`,
    [normalizedUserIds],
  );

  return normalizedUserIds.reduce((map, userId) => {
    const userRows = rows.filter((row) => Number(row.user_id) === Number(userId));
    if (userRows.length) {
      map.set(Number(userId), {
        source: "collaborator_qualifications",
        summary: buildSummaryFromRows(userRows),
      });
    }
    return map;
  }, new Map());
};

const listQualificationsByUserId = async (userId) => {
  const normalizedUserId = Number(userId);
  if (!normalizedUserId) {
    return {
      source: "collaborator_qualifications",
      qualifications: [],
      summary: buildEmptySummary(),
    };
  }

  if (!(await hasCollaboratorQualificationsTable())) {
    return {
      source: "collaborator_qualifications",
      qualifications: [],
      summary: buildEmptySummary(),
    };
  }

  const { rows } = await db.query(
    `SELECT
        id,
        user_id,
        qualification_type,
        title,
        institution,
        issuer,
        issue_date,
        expiry_date,
        registration_number,
        metadata,
        drive_file_id,
        drive_url,
        file_name,
        mime_type,
        uploaded_by,
        is_active,
        created_at,
        updated_at
     FROM collaborator_qualifications
     WHERE user_id = $1
       AND is_active = true
     ORDER BY created_at DESC, id DESC`,
    [normalizedUserId],
  );

  return {
    source: "collaborator_qualifications",
    qualifications: rows,
    summary: buildSummaryFromRows(rows),
  };
};

const syncLegacyCertificationToQualification = async ({
  legacyCertification,
  uploadedBy,
}) => {
  if (!(await hasCollaboratorQualificationsTable())) return null;

  const qualificationType = resolveQualificationTypeFromLegacy(
    legacyCertification?.credential_type,
    legacyCertification?.metadata || {},
  );
  if (!qualificationType) return null;

  const metadata = legacyCertification?.metadata || {};
  const registrationNumber =
    metadata?.registration_number ||
    metadata?.credential_id ||
    metadata?.credentialId ||
    metadata?.folio ||
    null;

  const qualificationMetadata = {
    ...metadata,
    legacy: {
      source_table: "user_certifications",
      legacy_id: legacyCertification.id,
      legacy_credential_type: legacyCertification.credential_type || null,
    },
  };

  const updateResult = await db.query(
    `UPDATE collaborator_qualifications
     SET qualification_type = $2,
         title = $3,
         institution = $4,
         issuer = $5,
         issue_date = $6,
         expiry_date = $7,
         registration_number = $8,
         metadata = $9,
         drive_file_id = $10,
         drive_url = $11,
         uploaded_by = $12,
         is_active = $13,
         updated_at = NOW()
     WHERE metadata->'legacy'->>'legacy_id' = $1
     RETURNING *`,
    [
      String(legacyCertification.id),
      qualificationType,
      legacyCertification.title,
      metadata?.institution || metadata?.entity || legacyCertification.issuer || null,
      legacyCertification.issuer || null,
      legacyCertification.issue_date || null,
      legacyCertification.expiry_date || null,
      registrationNumber,
      qualificationMetadata,
      legacyCertification.drive_file_id || null,
      legacyCertification.file_url || null,
      uploadedBy || legacyCertification.user_id || null,
      legacyCertification.is_active !== false,
    ],
  );

  if (updateResult.rows[0]) return updateResult.rows[0];

  const insertResult = await db.query(
    `INSERT INTO collaborator_qualifications (
        user_id,
        qualification_type,
        title,
        institution,
        issuer,
        issue_date,
        expiry_date,
        registration_number,
        metadata,
        drive_file_id,
        drive_url,
        file_name,
        mime_type,
        uploaded_by,
        is_active,
        created_at,
        updated_at
     ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17
     )
     RETURNING *`,
    [
      legacyCertification.user_id,
      qualificationType,
      legacyCertification.title,
      metadata?.institution || metadata?.entity || legacyCertification.issuer || null,
      legacyCertification.issuer || null,
      legacyCertification.issue_date || null,
      legacyCertification.expiry_date || null,
      registrationNumber,
      qualificationMetadata,
      legacyCertification.drive_file_id || null,
      legacyCertification.file_url || null,
      null,
      null,
      uploadedBy || legacyCertification.user_id || null,
      legacyCertification.is_active !== false,
      legacyCertification.created_at || new Date(),
      legacyCertification.updated_at || new Date(),
    ],
  );

  return insertResult.rows[0] || null;
};

const softDeleteQualificationByLegacyId = async (legacyId) => {
  if (!(await hasCollaboratorQualificationsTable())) return false;

  const result = await db.query(
    `UPDATE collaborator_qualifications
     SET is_active = false,
         updated_at = NOW()
     WHERE metadata->'legacy'->>'legacy_id' = $1
       AND is_active = true`,
    [String(legacyId)],
  );

  return result.rowCount > 0;
};

module.exports = {
  buildEmptySummary,
  hasCollaboratorQualificationsTable,
  listQualificationsByUserId,
  resolveQualificationTypeFromLegacy,
  softDeleteQualificationByLegacyId,
  summarizeQualificationsByUserIds,
  syncLegacyCertificationToQualification,
};
