// Provincias y cantones del Ecuador — datos estáticos, sin llamada al servidor
// Fuente: División político-administrativa del Ecuador (INEC 2023)
// Formato: { canton, provincia } — ordenados alfabéticamente por cantón

const ECUADOR_LOCATIONS = [
  // Azuay
  { canton: "Camilo Ponce Enríquez", provincia: "Azuay" },
  { canton: "Chordeleg", provincia: "Azuay" },
  { canton: "Cuenca", provincia: "Azuay" },
  { canton: "El Pan", provincia: "Azuay" },
  { canton: "Girón", provincia: "Azuay" },
  { canton: "Gualaceo", provincia: "Azuay" },
  { canton: "Guachapala", provincia: "Azuay" },
  { canton: "Nabón", provincia: "Azuay" },
  { canton: "Oña", provincia: "Azuay" },
  { canton: "Paute", provincia: "Azuay" },
  { canton: "Pucará", provincia: "Azuay" },
  { canton: "San Fernando", provincia: "Azuay" },
  { canton: "Santa Isabel", provincia: "Azuay" },
  { canton: "Sevilla de Oro", provincia: "Azuay" },
  { canton: "Sigsig", provincia: "Azuay" },
  // Bolívar
  { canton: "Caluma", provincia: "Bolívar" },
  { canton: "Chillanes", provincia: "Bolívar" },
  { canton: "Chimbo", provincia: "Bolívar" },
  { canton: "Echeandía", provincia: "Bolívar" },
  { canton: "Guaranda", provincia: "Bolívar" },
  { canton: "Las Naves", provincia: "Bolívar" },
  { canton: "San Miguel", provincia: "Bolívar" },
  // Cañar
  { canton: "Azogues", provincia: "Cañar" },
  { canton: "Biblián", provincia: "Cañar" },
  { canton: "Cañar", provincia: "Cañar" },
  { canton: "Déleg", provincia: "Cañar" },
  { canton: "El Tambo", provincia: "Cañar" },
  { canton: "La Troncal", provincia: "Cañar" },
  { canton: "Suscal", provincia: "Cañar" },
  // Carchi
  { canton: "Bolívar", provincia: "Carchi" },
  { canton: "Espejo", provincia: "Carchi" },
  { canton: "Mira", provincia: "Carchi" },
  { canton: "Montúfar", provincia: "Carchi" },
  { canton: "San Pedro de Huaca", provincia: "Carchi" },
  { canton: "Tulcán", provincia: "Carchi" },
  // Chimborazo
  { canton: "Alausí", provincia: "Chimborazo" },
  { canton: "Chambo", provincia: "Chimborazo" },
  { canton: "Chunchi", provincia: "Chimborazo" },
  { canton: "Colta", provincia: "Chimborazo" },
  { canton: "Cumandá", provincia: "Chimborazo" },
  { canton: "Guamote", provincia: "Chimborazo" },
  { canton: "Guano", provincia: "Chimborazo" },
  { canton: "Pallatanga", provincia: "Chimborazo" },
  { canton: "Penipe", provincia: "Chimborazo" },
  { canton: "Riobamba", provincia: "Chimborazo" },
  // Cotopaxi
  { canton: "La Maná", provincia: "Cotopaxi" },
  { canton: "Latacunga", provincia: "Cotopaxi" },
  { canton: "Pangua", provincia: "Cotopaxi" },
  { canton: "Pujilí", provincia: "Cotopaxi" },
  { canton: "Salcedo", provincia: "Cotopaxi" },
  { canton: "Saquisilí", provincia: "Cotopaxi" },
  { canton: "Sigchos", provincia: "Cotopaxi" },
  // El Oro
  { canton: "Arenillas", provincia: "El Oro" },
  { canton: "Atahualpa", provincia: "El Oro" },
  { canton: "Balsas", provincia: "El Oro" },
  { canton: "Chilla", provincia: "El Oro" },
  { canton: "El Guabo", provincia: "El Oro" },
  { canton: "Huaquillas", provincia: "El Oro" },
  { canton: "Las Lajas", provincia: "El Oro" },
  { canton: "Machala", provincia: "El Oro" },
  { canton: "Marcabelí", provincia: "El Oro" },
  { canton: "Pasaje", provincia: "El Oro" },
  { canton: "Piñas", provincia: "El Oro" },
  { canton: "Portovelo", provincia: "El Oro" },
  { canton: "Santa Rosa", provincia: "El Oro" },
  { canton: "Zaruma", provincia: "El Oro" },
  // Esmeraldas
  { canton: "Atacames", provincia: "Esmeraldas" },
  { canton: "Eloy Alfaro", provincia: "Esmeraldas" },
  { canton: "Esmeraldas", provincia: "Esmeraldas" },
  { canton: "Muisne", provincia: "Esmeraldas" },
  { canton: "Quinindé", provincia: "Esmeraldas" },
  { canton: "Rioverde", provincia: "Esmeraldas" },
  { canton: "San Lorenzo", provincia: "Esmeraldas" },
  // Galápagos
  { canton: "Isabela", provincia: "Galápagos" },
  { canton: "San Cristóbal", provincia: "Galápagos" },
  { canton: "Santa Cruz", provincia: "Galápagos" },
  // Guayas
  { canton: "Alfredo Baquerizo Moreno", provincia: "Guayas" },
  { canton: "Balao", provincia: "Guayas" },
  { canton: "Balzar", provincia: "Guayas" },
  { canton: "Colimes", provincia: "Guayas" },
  { canton: "Coronel Marcelino Maridueña", provincia: "Guayas" },
  { canton: "Daule", provincia: "Guayas" },
  { canton: "Durán", provincia: "Guayas" },
  { canton: "El Empalme", provincia: "Guayas" },
  { canton: "El Triunfo", provincia: "Guayas" },
  { canton: "General Antonio Elizalde", provincia: "Guayas" },
  { canton: "Guayaquil", provincia: "Guayas" },
  { canton: "Isidro Ayora", provincia: "Guayas" },
  { canton: "Lomas de Sargentillo", provincia: "Guayas" },
  { canton: "Milagro", provincia: "Guayas" },
  { canton: "Naranjal", provincia: "Guayas" },
  { canton: "Naranjito", provincia: "Guayas" },
  { canton: "Nobol", provincia: "Guayas" },
  { canton: "Palestina", provincia: "Guayas" },
  { canton: "Pedro Carbo", provincia: "Guayas" },
  { canton: "Playas", provincia: "Guayas" },
  { canton: "Samborondón", provincia: "Guayas" },
  { canton: "San Jacinto de Yaguachi", provincia: "Guayas" },
  { canton: "Santa Lucía", provincia: "Guayas" },
  { canton: "Simón Bolívar", provincia: "Guayas" },
  // Imbabura
  { canton: "Antonio Ante", provincia: "Imbabura" },
  { canton: "Cotacachi", provincia: "Imbabura" },
  { canton: "Ibarra", provincia: "Imbabura" },
  { canton: "Otavalo", provincia: "Imbabura" },
  { canton: "Pimampiro", provincia: "Imbabura" },
  { canton: "San Miguel de Urcuquí", provincia: "Imbabura" },
  // Loja
  { canton: "Calvas", provincia: "Loja" },
  { canton: "Catamayo", provincia: "Loja" },
  { canton: "Célica", provincia: "Loja" },
  { canton: "Chaguarpamba", provincia: "Loja" },
  { canton: "Espíndola", provincia: "Loja" },
  { canton: "Gonzanamá", provincia: "Loja" },
  { canton: "Loja", provincia: "Loja" },
  { canton: "Macará", provincia: "Loja" },
  { canton: "Olmedo", provincia: "Loja" },
  { canton: "Paltas", provincia: "Loja" },
  { canton: "Pindal", provincia: "Loja" },
  { canton: "Puyango", provincia: "Loja" },
  { canton: "Quilanga", provincia: "Loja" },
  { canton: "Saraguro", provincia: "Loja" },
  { canton: "Sozoranga", provincia: "Loja" },
  { canton: "Zapotillo", provincia: "Loja" },
  // Los Ríos
  { canton: "Baba", provincia: "Los Ríos" },
  { canton: "Babahoyo", provincia: "Los Ríos" },
  { canton: "Buena Fe", provincia: "Los Ríos" },
  { canton: "Mocache", provincia: "Los Ríos" },
  { canton: "Montalvo", provincia: "Los Ríos" },
  { canton: "Palenque", provincia: "Los Ríos" },
  { canton: "Pueblo Viejo", provincia: "Los Ríos" },
  { canton: "Quevedo", provincia: "Los Ríos" },
  { canton: "Quinsaloma", provincia: "Los Ríos" },
  { canton: "Urdaneta", provincia: "Los Ríos" },
  { canton: "Valencia", provincia: "Los Ríos" },
  { canton: "Ventanas", provincia: "Los Ríos" },
  { canton: "Vinces", provincia: "Los Ríos" },
  // Manabí
  { canton: "24 de Mayo", provincia: "Manabí" },
  { canton: "Bolívar", provincia: "Manabí" },
  { canton: "Chone", provincia: "Manabí" },
  { canton: "El Carmen", provincia: "Manabí" },
  { canton: "Flavio Alfaro", provincia: "Manabí" },
  { canton: "Jama", provincia: "Manabí" },
  { canton: "Jaramijó", provincia: "Manabí" },
  { canton: "Jipijapa", provincia: "Manabí" },
  { canton: "Junín", provincia: "Manabí" },
  { canton: "Manta", provincia: "Manabí" },
  { canton: "Montecristi", provincia: "Manabí" },
  { canton: "Olmedo", provincia: "Manabí" },
  { canton: "Paján", provincia: "Manabí" },
  { canton: "Pedernales", provincia: "Manabí" },
  { canton: "Pichincha", provincia: "Manabí" },
  { canton: "Portoviejo", provincia: "Manabí" },
  { canton: "Puerto López", provincia: "Manabí" },
  { canton: "Rocafuerte", provincia: "Manabí" },
  { canton: "San Vicente", provincia: "Manabí" },
  { canton: "Santa Ana", provincia: "Manabí" },
  { canton: "Sucre", provincia: "Manabí" },
  { canton: "Tosagua", provincia: "Manabí" },
  // Morona Santiago
  { canton: "Gualaquiza", provincia: "Morona Santiago" },
  { canton: "Huamboya", provincia: "Morona Santiago" },
  { canton: "Limón Indanza", provincia: "Morona Santiago" },
  { canton: "Logroño", provincia: "Morona Santiago" },
  { canton: "Macas", provincia: "Morona Santiago" },
  { canton: "Morona", provincia: "Morona Santiago" },
  { canton: "Pablo Sexto", provincia: "Morona Santiago" },
  { canton: "Palora", provincia: "Morona Santiago" },
  { canton: "San Juan Bosco", provincia: "Morona Santiago" },
  { canton: "Santiago", provincia: "Morona Santiago" },
  { canton: "Sucúa", provincia: "Morona Santiago" },
  { canton: "Taisha", provincia: "Morona Santiago" },
  { canton: "Tiwintza", provincia: "Morona Santiago" },
  // Napo
  { canton: "Archidona", provincia: "Napo" },
  { canton: "Carlos Julio Arosemena Tola", provincia: "Napo" },
  { canton: "El Chaco", provincia: "Napo" },
  { canton: "Quijos", provincia: "Napo" },
  { canton: "Tena", provincia: "Napo" },
  // Orellana
  { canton: "Aguarico", provincia: "Orellana" },
  { canton: "La Joya de los Sachas", provincia: "Orellana" },
  { canton: "Loreto", provincia: "Orellana" },
  { canton: "Puerto Francisco de Orellana", provincia: "Orellana" },
  // Pastaza
  { canton: "Arajuno", provincia: "Pastaza" },
  { canton: "Mera", provincia: "Pastaza" },
  { canton: "Puyo", provincia: "Pastaza" },
  { canton: "Santa Clara", provincia: "Pastaza" },
  // Pichincha
  { canton: "Cayambe", provincia: "Pichincha" },
  { canton: "Mejía", provincia: "Pichincha" },
  { canton: "Pedro Moncayo", provincia: "Pichincha" },
  { canton: "Pedro Vicente Maldonado", provincia: "Pichincha" },
  { canton: "Puerto Quito", provincia: "Pichincha" },
  { canton: "Quito", provincia: "Pichincha" },
  { canton: "Rumiñahui", provincia: "Pichincha" },
  { canton: "San Miguel de los Bancos", provincia: "Pichincha" },
  // Santa Elena
  { canton: "La Libertad", provincia: "Santa Elena" },
  { canton: "Salinas", provincia: "Santa Elena" },
  { canton: "Santa Elena", provincia: "Santa Elena" },
  // Santo Domingo de los Tsáchilas
  { canton: "La Concordia", provincia: "Santo Domingo de los Tsáchilas" },
  { canton: "Santo Domingo", provincia: "Santo Domingo de los Tsáchilas" },
  // Sucumbíos
  { canton: "Cascales", provincia: "Sucumbíos" },
  { canton: "Cuyabeno", provincia: "Sucumbíos" },
  { canton: "Gonzalo Pizarro", provincia: "Sucumbíos" },
  { canton: "Lago Agrio", provincia: "Sucumbíos" },
  { canton: "Putumayo", provincia: "Sucumbíos" },
  { canton: "Shushufindi", provincia: "Sucumbíos" },
  { canton: "Sucumbíos", provincia: "Sucumbíos" },
  // Tungurahua
  { canton: "Ambato", provincia: "Tungurahua" },
  { canton: "Baños de Agua Santa", provincia: "Tungurahua" },
  { canton: "Cevallos", provincia: "Tungurahua" },
  { canton: "Mocha", provincia: "Tungurahua" },
  { canton: "Patate", provincia: "Tungurahua" },
  { canton: "Quero", provincia: "Tungurahua" },
  { canton: "San Pedro de Pelileo", provincia: "Tungurahua" },
  { canton: "Santiago de Píllaro", provincia: "Tungurahua" },
  { canton: "Tisaleo", provincia: "Tungurahua" },
  // Zamora Chinchipe
  { canton: "Centinela del Cóndor", provincia: "Zamora Chinchipe" },
  { canton: "Chinchipe", provincia: "Zamora Chinchipe" },
  { canton: "El Pangui", provincia: "Zamora Chinchipe" },
  { canton: "Nangaritza", provincia: "Zamora Chinchipe" },
  { canton: "Palanda", provincia: "Zamora Chinchipe" },
  { canton: "Paquisha", provincia: "Zamora Chinchipe" },
  { canton: "Yacuambi", provincia: "Zamora Chinchipe" },
  { canton: "Yantzaza", provincia: "Zamora Chinchipe" },
  { canton: "Zamora", provincia: "Zamora Chinchipe" },
];

// Lista de provincias únicas (para búsqueda por provincia)
export const ECUADOR_PROVINCES = [...new Set(ECUADOR_LOCATIONS.map((l) => l.provincia))].sort();

/**
 * Busca cantones/provincias que coincidan con el término ingresado.
 * Busca en canton y en provincia. Devuelve máx. 8 resultados.
 * @param {string} term
 * @returns {{ canton: string, provincia: string, label: string }[]}
 */
export function searchEcuadorLocations(term) {
  if (!term || term.trim().length < 2) return [];
  const needle = term
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

  return ECUADOR_LOCATIONS.filter((loc) => {
    const haystack = `${loc.canton} ${loc.provincia}`
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "");
    return haystack.includes(needle);
  })
    .slice(0, 8)
    .map((loc) => ({
      ...loc,
      label: `${loc.canton}, ${loc.provincia}`,
    }));
}

export default ECUADOR_LOCATIONS;
