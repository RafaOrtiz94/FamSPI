const db = require("../../config/db");
const logger = require("../../config/logger");

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hora
const CACHE_TTL_SECONDS = 60 * 60;

/**
 * @typedef {Object} WeightedFactor
 * @property {string} name
 * @property {number} weight
 * @property {number} points
 * @property {number} maxPoints
 * @property {string} rule
 * @property {Object} raw
 */

/**
 * @typedef {Object} WinProbabilityResult
 * @property {string} business_case_id
 * @property {number} win_probability
 * @property {Object} scoring_metadata
 * @property {"cache"|"computed"} source
 */

class BusinessCaseScoringService {
  constructor() {
    /** @type {Map<string, {value: WinProbabilityResult, expiresAt: number}>} */
    this.localCache = new Map();
    this.redisClient = null;
    this.redisInitAttempted = false;
    this.redisReady = false;
    this.scoringColumnsReady = false;
    this.scoringColumnsPromise = null;
  }

  _cacheKey(bcId) {
    return `bc:win_probability:${bcId}`;
  }

  async _initRedisIfAvailable() {
    if (this.redisInitAttempted) return this.redisReady;
    this.redisInitAttempted = true;

    const redisUrl = process.env.REDIS_URL || process.env.REDIS_CONNECTION_STRING;
    if (!redisUrl) return false;

    let createClient = null;
    try {
      ({ createClient } = require("redis"));
    } catch (_error) {
      logger.warn(
        { bcScoring: true },
        "Redis no disponible en runtime; se usa cache local en memoria"
      );
      return false;
    }

    try {
      this.redisClient = createClient({ url: redisUrl });
      this.redisClient.on("error", (error) => {
        logger.warn({ error: error.message }, "Error de cliente Redis en BC scoring");
      });
      await this.redisClient.connect();
      this.redisReady = true;
      return true;
    } catch (error) {
      logger.warn(
        { error: error.message },
        "No se pudo conectar a Redis para BC scoring; se usa cache local"
      );
      this.redisReady = false;
      this.redisClient = null;
      return false;
    }
  }

  async _getFromCache(cacheKey) {
    const redisEnabled = await this._initRedisIfAvailable();
    if (redisEnabled && this.redisClient) {
      try {
        const payload = await this.redisClient.get(cacheKey);
        if (payload) return JSON.parse(payload);
      } catch (error) {
        logger.warn(
          { error: error.message, cacheKey },
          "No se pudo leer cache Redis de BC scoring"
        );
      }
    }

    const entry = this.localCache.get(cacheKey);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
      this.localCache.delete(cacheKey);
      return null;
    }
    return entry.value;
  }

  async _setInCache(cacheKey, value) {
    this.localCache.set(cacheKey, {
      value,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });

    const redisEnabled = await this._initRedisIfAvailable();
    if (redisEnabled && this.redisClient) {
      try {
        await this.redisClient.setEx(cacheKey, CACHE_TTL_SECONDS, JSON.stringify(value));
      } catch (error) {
        logger.warn(
          { error: error.message, cacheKey },
          "No se pudo escribir cache Redis de BC scoring"
        );
      }
    }
  }

  async invalidateCache(bcId) {
    if (!bcId) return;
    const cacheKey = this._cacheKey(bcId);
    this.localCache.delete(cacheKey);

    const redisEnabled = await this._initRedisIfAvailable();
    if (redisEnabled && this.redisClient) {
      try {
        await this.redisClient.del(cacheKey);
      } catch (error) {
        logger.warn(
          { error: error.message, cacheKey },
          "No se pudo invalidar cache Redis de BC scoring"
        );
      }
    }
  }

  async _ensureScoringColumns() {
    if (this.scoringColumnsReady) return;
    if (this.scoringColumnsPromise) {
      await this.scoringColumnsPromise;
      return;
    }

    this.scoringColumnsPromise = (async () => {
      await db.query(`
        ALTER TABLE public.bc_calculations
        ADD COLUMN IF NOT EXISTS win_probability numeric(5,2),
        ADD COLUMN IF NOT EXISTS scoring_metadata jsonb DEFAULT '{}'::jsonb
      `);
      this.scoringColumnsReady = true;
    })();

    try {
      await this.scoringColumnsPromise;
    } finally {
      this.scoringColumnsPromise = null;
    }
  }

  async _loadScoringContext(bcId) {
    const { rows } = await db.query(
      `
        WITH target_bc AS (
          SELECT
            v.business_case_id,
            v.client_id,
            v.created_at,
            v.bc_stage,
            v.status,
            v.modern_bc_metadata
          FROM v_business_cases v
          WHERE v.business_case_id = $1
          LIMIT 1
        ),
        calc AS (
          SELECT
            c.business_case_id,
            c.roi_percentage
          FROM public.bc_calculations c
          WHERE c.business_case_id = $1
          LIMIT 1
        ),
        client_history AS (
          SELECT
            t.business_case_id,
            COUNT(*) FILTER (
              WHERE h.business_case_id <> t.business_case_id
            )::int AS prior_cases_total,
            COUNT(*) FILTER (
              WHERE h.business_case_id <> t.business_case_id
                AND h.created_at >= (NOW() - INTERVAL '1 year')
                AND (
                  LOWER(COALESCE(h.bc_stage, '')) = 'factible'
                  OR LOWER(COALESCE(h.status, '')) = 'factible'
                  OR LOWER(COALESCE(h.modern_bc_metadata->'feasibility'->'decision'->>'is_feasible', 'false')) = 'true'
                )
            )::int AS factible_last_year
          FROM target_bc t
          LEFT JOIN v_business_cases h
            ON h.client_id = t.client_id
          GROUP BY t.business_case_id
        )
        SELECT
          t.business_case_id,
          t.client_id,
          t.created_at,
          c.roi_percentage,
          ch.prior_cases_total,
          ch.factible_last_year,
          (EXTRACT(EPOCH FROM (NOW() - t.created_at)) / 3600.0)::numeric(12,2) AS elapsed_hours
        FROM target_bc t
        LEFT JOIN calc c
          ON c.business_case_id = t.business_case_id
        LEFT JOIN client_history ch
          ON ch.business_case_id = t.business_case_id
      `,
      [bcId]
    );

    return rows[0] || null;
  }

  /**
   * Rentabilidad (40%)
   * ROI > 40 => 40 pts
   * ROI entre 20 y 40 => 25 pts
   * ROI < 20 => 10 pts
   * @param {number} roiPercentage
   * @returns {WeightedFactor}
   */
  _scoreRentability(roiPercentage) {
    let points = 10;
    let rule = "ROI < 20%";

    if (roiPercentage > 40) {
      points = 40;
      rule = "ROI > 40%";
    } else if (roiPercentage >= 20 && roiPercentage <= 40) {
      points = 25;
      rule = "ROI entre 20% y 40%";
    }

    return {
      name: "rentability",
      weight: 0.4,
      points,
      maxPoints: 40,
      rule,
      raw: { roi_percentage: roiPercentage },
    };
  }

  /**
   * Fidelidad del cliente (30%)
   * >3 casos factibles ultimo año => 30 pts
   * cliente nuevo => 15 pts
   * caso intermedio => 22 pts
   * @param {number} factibleLastYear
   * @param {number} priorCasesTotal
   * @returns {WeightedFactor}
   */
  _scoreClientFidelity(factibleLastYear, priorCasesTotal) {
    let points = 22;
    let rule = "Cliente con historial parcial";

    if (factibleLastYear > 3) {
      points = 30;
      rule = ">3 casos factibles en ultimo año";
    } else if (priorCasesTotal === 0) {
      points = 15;
      rule = "Cliente nuevo";
    }

    return {
      name: "client_fidelity",
      weight: 0.3,
      points,
      maxPoints: 30,
      rule,
      raw: {
        factible_last_year: factibleLastYear,
        prior_cases_total: priorCasesTotal,
      },
    };
  }

  /**
   * Eficiencia operativa (30%)
   * <72h => 30 pts
   * >7 dias => 5 pts
   * intermedio => decaimiento lineal entre 30 y 5
   * @param {number} elapsedHours
   * @returns {WeightedFactor}
   */
  _scoreOperationalEfficiency(elapsedHours) {
    let points = 30;
    let rule = "<72h";

    if (elapsedHours > 168) {
      points = 5;
      rule = ">7 dias (penalizacion por estancamiento)";
    } else if (elapsedHours >= 72) {
      const ratio = (elapsedHours - 72) / (168 - 72);
      points = Number((30 - (ratio * 25)).toFixed(2));
      rule = "entre 72h y 7 dias (decaimiento lineal)";
    }

    return {
      name: "operational_efficiency",
      weight: 0.3,
      points,
      maxPoints: 30,
      rule,
      raw: { elapsed_hours: elapsedHours },
    };
  }

  async _persistScoring(bcId, winProbability, metadata) {
    await this._ensureScoringColumns();
    const client = await db.getClient();

    try {
      await client.query("BEGIN");
      await client.query(
        `
          INSERT INTO public.bc_calculations (
            business_case_id,
            win_probability,
            scoring_metadata,
            calculated_at,
            calculation_version
          )
          VALUES ($1, $2, $3::jsonb, NOW(), 1)
          ON CONFLICT (business_case_id)
          DO UPDATE SET
            win_probability = EXCLUDED.win_probability,
            scoring_metadata = EXCLUDED.scoring_metadata,
            calculated_at = NOW(),
            calculation_version = COALESCE(public.bc_calculations.calculation_version, 0) + 1
        `,
        [bcId, winProbability, JSON.stringify(metadata)]
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Calcula y persiste la probabilidad de exito (0-100) de un Business Case.
   * @param {string} bcId
   * @param {{forceRefresh?: boolean}} [options]
   * @returns {Promise<WinProbabilityResult|null>}
   */
  async calculateWinProbability(bcId, options = {}) {
    const id = String(bcId || "").trim();
    if (!id) {
      const error = new Error("bcId es requerido para calcular win probability");
      error.status = 400;
      throw error;
    }

    const cacheKey = this._cacheKey(id);
    const forceRefresh = Boolean(options?.forceRefresh);

    if (!forceRefresh) {
      const cached = await this._getFromCache(cacheKey);
      if (cached) return { ...cached, source: "cache" };
    }

    let context = null;
    try {
      context = await this._loadScoringContext(id);
    } catch (error) {
      logger.error(
        { error: error.message, bcId: id },
        "Error consultando contexto de scoring de Business Case"
      );
      throw error;
    }

    if (!context) {
      logger.warn(
        { bcId: id, missingFields: ["business_case"] },
        "No se pudo calcular win probability: Business Case no encontrado"
      );
      return null;
    }

    const missingFields = [];
    if (context.client_id == null) missingFields.push("client_id");
    if (!context.created_at) missingFields.push("created_at");
    if (context.roi_percentage == null) missingFields.push("roi_percentage");

    if (missingFields.length) {
      logger.warn(
        { bcId: id, missingFields },
        "No se pudo calcular win probability por datos criticos faltantes"
      );
      return null;
    }

    const roi = Number(context.roi_percentage);
    const factibleLastYear = Number(context.factible_last_year || 0);
    const priorCasesTotal = Number(context.prior_cases_total || 0);
    const elapsedHours = Number(context.elapsed_hours || 0);

    const factors = [
      this._scoreRentability(roi),
      this._scoreClientFidelity(factibleLastYear, priorCasesTotal),
      this._scoreOperationalEfficiency(elapsedHours),
    ];

    const totalScore = Number(
      factors.reduce((acc, factor) => acc + Number(factor.points || 0), 0).toFixed(2)
    );

    const metadata = {
      model: "weighted_scoring_v1",
      calculated_at: new Date().toISOString(),
      factors,
      raw: {
        roi_percentage: roi,
        factible_last_year: factibleLastYear,
        prior_cases_total: priorCasesTotal,
        elapsed_hours: elapsedHours,
      },
    };

    try {
      await this._persistScoring(id, totalScore, metadata);
    } catch (error) {
      logger.error(
        { error: error.message, bcId: id },
        "Error persistiendo win probability en bc_calculations"
      );
      throw error;
    }

    const result = {
      business_case_id: id,
      win_probability: totalScore,
      scoring_metadata: metadata,
      source: "computed",
    };

    await this._setInCache(cacheKey, result);
    return result;
  }
}

module.exports = new BusinessCaseScoringService();
