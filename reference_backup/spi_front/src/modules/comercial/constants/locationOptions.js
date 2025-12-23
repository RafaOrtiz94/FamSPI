export const COUNTRY_LOCATIONS = {
  Ecuador: {
    provinces: {
      Azuay: ["Cuenca", "Gualaceo", "Paute", "Sigsig"],
      Bolívar: ["Guaranda", "San Miguel", "Chillanes"],
      Cañar: ["Azogues", "La Troncal", "Biblián"],
      Carchi: ["Tulcán", "Montúfar", "Espejo"],
      Chimborazo: ["Riobamba", "Guano", "Cumandá"],
      Cotopaxi: ["Latacunga", "Salcedo", "Saquisilí"],
      El_Oro: ["Machala", "Santa Rosa", "Pasaje"],
      Esmeraldas: ["Esmeraldas", "Atacames", "Quinindé"],
      Galápagos: ["Puerto Baquerizo Moreno", "Puerto Ayora"],
      Guayas: ["Guayaquil", "Daule", "Samborondón", "Milagro"],
      Imbabura: ["Ibarra", "Otavalo", "Cotacachi"],
      Loja: ["Loja", "Catamayo", "Macará"],
      Los_Ríos: ["Babahoyo", "Quevedo", "Ventanas"],
      Manabí: ["Portoviejo", "Manta", "Chone"],
      Morona_Santiago: ["Macas", "Sucúa", "Gualaquiza"],
      Napo: ["Tena", "Archidona"],
      Orellana: ["Francisco de Orellana", "Joya de los Sachas"],
      Pastaza: ["Puyo", "Mera"],
      Pichincha: ["Quito", "Rumiñahui", "Cayambe"],
      Santa_Elena: ["La Libertad", "Salinas", "Santa Elena"],
      Santo_Domingo_de_los_Tsáchilas: ["Santo Domingo", "La Concordia"],
      Sucumbíos: ["Nueva Loja", "Shushufindi"],
      Tungurahua: ["Ambato", "Pelileo", "Baños de Agua Santa"],
      Zamora_Chinchipe: ["Zamora", "Yantzaza", "Zumba"],
    },
  },
  Perú: {
    provinces: {
      Amazonas: ["Chachapoyas", "Bagua"],
      Áncash: ["Huaraz", "Chimbote"],
      Apurímac: ["Abancay", "Andahuaylas"],
      Arequipa: ["Arequipa", "Camana", "Mollendo"],
      Ayacucho: ["Ayacucho", "Huanta"],
      Cajamarca: ["Cajamarca", "Jaén"],
      Cusco: ["Cusco", "Sicuani", "Quillabamba"],
      Huancavelica: ["Huancavelica", "Tayacaja"],
      Huánuco: ["Huánuco", "Tingo María"],
      Ica: ["Ica", "Pisco", "Chincha Alta"],
      Junín: ["Huancayo", "La Oroya", "Tarma"],
      La_Libertad: ["Trujillo", "Chepén", "Virú"],
      Lambayeque: ["Chiclayo", "Lambayeque", "Ferreñafe"],
      Lima: ["Lima", "Barranca", "Huacho"],
      Loreto: ["Iquitos", "Nauta"],
      Madre_de_Dios: ["Puerto Maldonado"],
      Moquegua: ["Moquegua", "Ilo"],
      Pasco: ["Cerro de Pasco", "Oxapampa"],
      Piura: ["Piura", "Sullana", "Paita"],
      Puno: ["Puno", "Juliaca"],
      San_Martín: ["Tarapoto", "Moyobamba"],
      Tacna: ["Tacna"],
      Tumbes: ["Tumbes", "Zarumilla"],
      Ucayali: ["Pucallpa"]
    },
  },
};

export const getCountryOptions = () => Object.keys(COUNTRY_LOCATIONS);

export const getProvinceOptions = (country) =>
  Object.keys(COUNTRY_LOCATIONS[country]?.provinces || {});

export const getCityOptions = (country, province) =>
  COUNTRY_LOCATIONS[country]?.provinces?.[province] || [];
