const db = require("../../config/db");

const normalizeCorporatePhone = (value) => String(value || "").trim();

const getAssignedCorporatePhoneByUserId = async (userId, executor = db) => {
  if (!userId) return "";

  const { rows } = await executor.query(
    `SELECT COALESCE(cn.number, '') AS number
       FROM public.ti_corporate_numbers cn
      WHERE cn.assigned_to_user_id = $1
        AND cn.status = 'assigned'
      ORDER BY cn.assigned_at DESC NULLS LAST, cn.updated_at DESC, cn.id DESC
      LIMIT 1`,
    [userId],
  );

  return normalizeCorporatePhone(rows[0]?.number);
};

const stripCorporatePhoneFromProfile = (profile = {}) => {
  const next = {
    ...(profile || {}),
    laboral: {
      ...((profile || {}).laboral || {}),
    },
  };

  delete next?.laboral?.telefono_celular_famproject;
  return next;
};

const injectCorporatePhoneIntoProfile = (profile = {}, corporatePhone = "") => {
  const next = stripCorporatePhoneFromProfile(profile);
  next.laboral = {
    ...(next.laboral || {}),
    telefono_celular_famproject: normalizeCorporatePhone(corporatePhone),
  };
  return next;
};

const stripCorporatePhoneFromUserMetadata = (metadata = {}) => {
  const next = {
    ...(metadata || {}),
    laboral: {
      ...((metadata || {}).laboral || {}),
    },
  };

  delete next.phone;
  delete next?.laboral?.telefono_celular_famproject;
  return next;
};

const injectCorporatePhoneIntoUserMetadata = (metadata = {}, corporatePhone = "") => {
  const next = stripCorporatePhoneFromUserMetadata(metadata);
  const normalizedCorporatePhone = normalizeCorporatePhone(corporatePhone);

  next.phone = normalizedCorporatePhone;
  next.laboral = {
    ...(next.laboral || {}),
    telefono_celular_famproject: normalizedCorporatePhone,
  };

  return next;
};

module.exports = {
  getAssignedCorporatePhoneByUserId,
  injectCorporatePhoneIntoProfile,
  injectCorporatePhoneIntoUserMetadata,
  stripCorporatePhoneFromProfile,
  stripCorporatePhoneFromUserMetadata,
};
