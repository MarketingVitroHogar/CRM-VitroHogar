-- Catálogo de asesores en la base de datos: Coordinación podrá agregar y dar de baja asesores sin cambiar el código.
-- Solo AGREGA una tabla (no cambia ni borra nada) y la llena con los asesores que hoy están en el catálogo del código.
CREATE TABLE "Asesor" (
    "id" TEXT NOT NULL,
    "sucursal" "Sucursal" NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Asesor_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Asesor_sucursal_nombre_key" ON "Asesor"("sucursal", "nombre");
CREATE INDEX "Asesor_sucursal_activo_idx" ON "Asesor"("sucursal", "activo");

-- Asesores actuales (45), en el mismo orden en que aparecen hoy.
INSERT INTO "Asesor" ("id", "sucursal", "nombre", "orden")
SELECT md5(random()::text || clock_timestamp()::text || v.nombre), v.sucursal::"Sucursal", v.nombre, v.orden
FROM (VALUES
  ('BLVD_ZACATECAS', 'Genaro Samuel Alvarado Melesio', 0),
  ('BLVD_ZACATECAS', 'Raul Esparza Gonzalez', 1),
  ('BLVD_ZACATECAS', 'Jose Andres Hernandez Romero', 2),
  ('BLVD_ZACATECAS', 'Yuridia Marlenne Moreno Cruz', 3),
  ('BLVD_ZACATECAS', 'Karen Arely Ortega Hernandez', 4),
  ('BLVD_ZACATECAS', 'Juan Angel Ramirez Salazar', 5),
  ('BLVD_ZACATECAS', 'Adriana Rodriguez Mora', 6),
  ('BLVD_ZACATECAS', 'Edgar Daniel Contreras Morales', 7),
  ('UNIVERSIDAD', 'Ernesto Arturo Frausto Esparza', 0),
  ('UNIVERSIDAD', 'Luis Fernando Muñoz Muñoz', 1),
  ('UNIVERSIDAD', 'Jose Alfredo Macias Rodriguez', 2),
  ('HACIENDAS', 'Saray Salgado', 0),
  ('HACIENDAS', 'Miguel Torres', 1),
  ('HACIENDAS', 'Jessica Ruvalcaba', 2),
  ('LOPEZ_MATEOS', 'Jose Andrés Mireles Cornejo', 0),
  ('LOPEZ_MATEOS', 'Hugo Enrique Gonzalez Lara', 1),
  ('LOPEZ_MATEOS', 'Karen Paola Ponce Reyes', 2),
  ('AYUNTAMIENTO', 'Jesús Daniel Pérez Rios', 0),
  ('AYUNTAMIENTO', 'Karla Fabiola Morales Ramírez', 1),
  ('AYUNTAMIENTO', 'Bricia Thalía Silva Pérez', 2),
  ('PASEO_DE_LA_CRUZ', 'Diana Limon', 0),
  ('PASEO_DE_LA_CRUZ', 'David Medellin', 1),
  ('PASEO_DE_LA_CRUZ', 'Alejandra Raygoza', 2),
  ('PASEO_DE_LA_CRUZ', 'Miriam Cota', 3),
  ('PASEO_DE_LA_CRUZ', 'Adrián Perez', 4),
  ('RINCON_DE_ROMOS', 'Ma del Rocío Flores Roa', 0),
  ('RINCON_DE_ROMOS', 'Wendoline Calderón Márgenes', 1),
  ('RINCON_DE_ROMOS', 'José Armando Suárez Salazar', 2),
  ('RINCON_DE_ROMOS', 'José Luis Ureña Ovalle', 3),
  ('JESUS_MARIA', 'José Ignacio Galván Picón', 0),
  ('JESUS_MARIA', 'Jorge Luis Santana Vargas', 1),
  ('JESUS_MARIA', 'Silvina Martinez Santoyo', 2),
  ('GONZALEZ_GALLO', 'Sara Edelia Oregel Jara', 0),
  ('GONZALEZ_GALLO', 'Yolanda Rios Reyes', 1),
  ('GONZALEZ_GALLO', 'Lucía Adriana Salgado Rodríguez', 2),
  ('JUAN_PABLO', 'Mario Rafael Butron Muñoz', 0),
  ('JUAN_PABLO', 'Christian Oswaldo Tavares Hernandez', 1),
  ('JUAN_PABLO', 'Oscar Fernando Jara Sandoval', 2),
  ('GUADALUPE', 'Junior Gamaliel Ramirez Rodriguez', 0),
  ('GUADALUPE', 'Mayra Elizabeth Lugo Najar', 1),
  ('GUADALUPE', 'Norma Del Carmen Gonzalez Garcia', 2),
  ('COLON', 'Alejandra', 0),
  ('TLI', 'Cristian', 0),
  ('TLI', 'Karen', 1),
  ('TLI', 'Paola', 2)
) AS v(sucursal, nombre, orden);
