jest.mock("../../../config/db", () => ({ query: jest.fn(), getClient: jest.fn() }));
jest.mock("../../../utils/mailer", () => ({ sendBulkMail: jest.fn() }));
jest.mock("../../../config/logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));

const { renderCampaignEmail, personalize, campaignUrls } = require("../crmCampaignDelivery.service");

const recipient = {
  token: "11111111-2222-3333-4444-555555555555",
  recipient_name: "Ana <b>Perez</b>",
  laboratory_name: "Lab \"Central\"",
};

describe("personalize", () => {
  test("reemplaza ambas variables", () => {
    expect(personalize("Hola {{nombre_cliente}} de {{laboratorio}}", { recipient_name: "Ana", laboratory_name: "Lab 1" }))
      .toBe("Hola Ana de Lab 1");
  });
  test("usa valores por defecto sin destinatario", () => {
    expect(personalize("{{nombre_cliente}}/{{laboratorio}}", null)).toBe("Cliente/Laboratorio");
  });
});

describe("campaignUrls", () => {
  test("extrae las URL en orden y sin signos de cierre", () => {
    expect(campaignUrls('Mira https://a.com/x y (http://b.com/y) o "https://c.com"')).toEqual([
      "https://a.com/x", "http://b.com/y", "https://c.com",
    ]);
  });
});

describe("renderCampaignEmail", () => {
  const campaign = {
    body_content: "Hola {{nombre_cliente}}\nVisita https://fam.example/promo hoy\nO https://otro.example/ofertas",
    preheader: "Para {{laboratorio}}",
  };

  test("escapa HTML de las variables (sin inyeccion)", () => {
    const { html } = renderCampaignEmail({ campaign, recipient });
    expect(html).not.toContain("<b>Perez</b>");
    expect(html).toContain("Ana &lt;b&gt;Perez&lt;/b&gt;");
    expect(html).toContain("Lab &quot;Central&quot;");
  });

  test("con seguimiento: enlaces rastreados por indice, pixel y baja", () => {
    const { html, unsubscribeUrl } = renderCampaignEmail({ campaign, recipient, tracking: true });
    expect(html).toContain(`/api/v1/crm-campaigns/click/${recipient.token}/0`);
    expect(html).toContain(`/api/v1/crm-campaigns/click/${recipient.token}/1`);
    expect(html).toContain(`/api/v1/crm-campaigns/open/${recipient.token}.gif`);
    expect(unsubscribeUrl).toContain(`/api/v1/crm-campaigns/unsubscribe/${recipient.token}`);
    expect(html).toContain(unsubscribeUrl);
  });

  test("en la prueba no hay pixel ni enlaces rastreados, pero si baja", () => {
    const { html } = renderCampaignEmail({ campaign, recipient, tracking: false });
    expect(html).not.toContain("/click/");
    expect(html).not.toContain(".gif");
    expect(html).toContain("https://fam.example/promo");
    expect(html).toContain("/api/v1/crm-campaigns/unsubscribe/");
  });

  test("una variable con URL no desplaza los indices de los enlaces", () => {
    const evil = { ...recipient, recipient_name: "http://malo.example/x" };
    const { html } = renderCampaignEmail({ campaign, recipient: evil, tracking: true });
    expect(html.match(/\/click\//g)).toHaveLength(2);
  });
});
