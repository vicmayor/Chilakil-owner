# Chilakil Team → Owner App: inventario v1

`GET https://team.chilakiltogo.com/api/v1/inventory?location=all`

Encabezado: `Authorization: Bearer TOKEN`. Usar desde el servidor de Owner, con la clave guardada como secreto. No admite claves en la URL ni acceso mediante cookies de sesión. API solo de lectura: consultar no modifica existencias, compras ni fechas.

## Parámetros

- `location`: `glendale`, `avondale` o `all` (predeterminado). Los valores van en minúsculas.
- Es el único parámetro admitido. Un valor vacío o inválido, un parámetro duplicado o un parámetro desconocido produce `400`.
- No requiere período: devuelve el estado actual de cada localidad solicitada.

## Respuesta

Objeto con `generatedAt`, `timezone: "America/Phoenix"` y `locations`. `generatedAt` es la hora de generación del reporte, no la fecha del último conteo. Los instantes se expresan en formato ISO 8601 con zona horaria; las fechas de inventario corresponden a America/Phoenix.

Cada localidad contiene `location` (`glendale` o `avondale`), `items` y `summary`. Solo aparecen productos del catálogo operativo de esa localidad, incluso si todavía no se han revisado o contado. Registros históricos de productos que ya no aplican a esa localidad no se incluyen.

**Separación por localidad:** identificar cada registro por **location + id**. Un mismo producto puede aparecer en ambas localidades con cantidades y estados diferentes. `all` devuelve las dos localidades por separado; no suma existencias, compras ni resúmenes entre ellas.

Cada producto contiene:

- `id`: identificador estable del producto. No usar el nombre como clave.
- `name`: nombre en español del catálogo; `nameEn`: nombre en inglés; `category`: categoría del catálogo.
- `unit`: unidad base registrada, `piece` o `lb`; `null` si no se conoce.
- `unitLabel`: descripción del empaque en el catálogo, o `null` si falta. Por ejemplo, `300 / caja · case`. Es texto descriptivo, no una conversión automática a unidades base.
- `supplier`: proveedor registrado en el catálogo, o `null` si falta.
- `quantityOnHand`: existencia en unidades base, o `null` si no hay saldo conocido. Las piezas son enteras; las libras admiten hasta tres decimales. La API ya convierte las milésimas internas: no dividir nuevamente entre 1,000.
- `status`: `unreviewed`, `sufficient`, `low` u `out`; conserva la revisión cualitativa registrada en Team.
- `lowStock`: `true` si `status` es `low` u `out`, o si tanto la cantidad como el mínimo son conocidos y `quantityOnHand <= minimumLevel`. En cualquier otro caso, `false`.
- `parLevel`, `minimumLevel`, `unitCost`: actualmente `null`. Team no tiene estos valores configurados para este reporte; no se deducen de empaques, recibos ni otras localidades.
- `purchase`: `needed`, `purchased`, `shipped`, `received` o `null` cuando no hay estado de compra.
- `deliveryStatus`: `ordered`, `shipped` o `null` cuando no hay entrega pendiente registrada.
- `neededBy`: `tomorrow`, `this_week` o `null`; `neededDate`: fecha concreta `YYYY-MM-DD` o `null`.
- `lastCountedAt`: instante del último conteo físico en America/Phoenix, o `null`; `lastCountedBy`: nombre visible registrado para ese conteo, o `null` si no está disponible.
- `lastUpdatedAt`: instante más reciente entre la actualización del estado de inventario y el último movimiento de existencias, o `null`; `lastUpdatedBy`: nombre visible registrado para esa actualización, o `null` si no está disponible.

**Desconocido no significa cero:** conservar los `null`. Una entrega puede estar registrada sin que exista un conteo inicial; en ese caso el saldo sigue siendo desconocido. `unreviewed` no significa sin existencias. `lowStock: false` con cantidad y mínimo desconocidos tampoco confirma que haya suficiente producto.

**Cantidad y estado son independientes:** el conteo físico y sus movimientos no reemplazan automáticamente la revisión cualitativa. Mostrar ambos cuando estén disponibles. Marcar una compra como recibida no añade por sí solo unidades al registro de existencias. `purchase` describe la acción de compra y `deliveryStatus` la entrega pendiente; no inferir uno a partir del otro.

**Fechas necesarias:** `neededDate` queda fijada cuando se elige la urgencia en Team. `this_week` corresponde al sábado de esa semana, de domingo a sábado. Si la fecha ya pasó, sigue vencida; no moverla según la fecha de sincronización.

`summary` cuenta productos de esa localidad:

- `out`: `status === "out"`.
- `low`: `status === "low"`; no incluye `out` ni cuenta por `lowStock`.
- `toBuy`: `purchase === "needed"`.
- `onTheWay`: `deliveryStatus === "ordered"` o `"shipped"`.
- `unreviewed`: `status === "unreviewed"`.

Los grupos pueden coincidir: un producto sin existencias puede estar también en camino. No sumar estos contadores como si fueran categorías excluyentes.

## Clave y permiso

Se usa la misma clave existente de **Owner API**, guardada en el servidor de Owner como `CHILAKIL_TEAM_API_KEY`. Inventario requiere además el permiso independiente **`inventory:read`**, desactivado de forma predeterminada, incluso al crear o reemplazar una clave. El dueño debe habilitar explícitamente el acceso de inventario en Team → **Owner API**. Tener una clave válida para horas no habilita inventario automáticamente.

Para crear o reemplazar una clave: iniciar sesión como dueño en Team → **Owner API** → **Crear clave para Owner** o **Reemplazar clave**. Se muestra una sola vez. **Desconectar Owner** la revoca. Reemplazarla o revocarla afecta los endpoints que comparten esa clave. Team almacena únicamente su hash SHA-256 y no puede recuperar la clave anterior.

No poner la clave en el navegador, en parámetros de consulta, registros públicos ni repositorios. Ejemplo desde el servidor:

```sh
curl --fail-with-body \
  -H "Authorization: Bearer ${CHILAKIL_TEAM_API_KEY}" \
  'https://team.chilakiltogo.com/api/v1/inventory?location=all'
```

## Ejemplo de formato

**Ejemplo ilustrativo y abreviado, no una consulta en vivo.** Los IDs, nombres y descripciones corresponden al catálogo; las cantidades, estados y horas son ficticios. Se muestra un producto por localidad y los contadores de esos ejemplos únicamente. La respuesta real incluye el catálogo completo de cada localidad solicitada. Los nombres de personas se omiten con `null`; no hay credenciales ni datos reales de empleados.

```json
{
  "generatedAt": "2026-10-08T10:00:00-07:00",
  "timezone": "America/Phoenix",
  "locations": [
    {
      "location": "glendale",
      "items": [
        {
          "id": "bistro-bags-13",
          "name": "Bistro Bags 13″",
          "nameEn": "13″ Bistro Bags",
          "category": "supplies",
          "unit": "piece",
          "unitLabel": null,
          "supplier": null,
          "quantityOnHand": 24,
          "status": "low",
          "lowStock": true,
          "parLevel": null,
          "minimumLevel": null,
          "unitCost": null,
          "purchase": "needed",
          "deliveryStatus": null,
          "neededBy": "tomorrow",
          "neededDate": "2026-10-09",
          "lastCountedAt": "2026-10-08T09:00:00-07:00",
          "lastCountedBy": null,
          "lastUpdatedAt": "2026-10-08T09:05:00-07:00",
          "lastUpdatedBy": null
        }
      ],
      "summary": { "out": 0, "low": 1, "toBuy": 1, "onTheWay": 0, "unreviewed": 0 }
    },
    {
      "location": "avondale",
      "items": [
        {
          "id": "bistro-bags-13",
          "name": "Bistro Bags 13″",
          "nameEn": "13″ Bistro Bags",
          "category": "supplies",
          "unit": null,
          "unitLabel": null,
          "supplier": null,
          "quantityOnHand": null,
          "status": "unreviewed",
          "lowStock": false,
          "parLevel": null,
          "minimumLevel": null,
          "unitCost": null,
          "purchase": null,
          "deliveryStatus": null,
          "neededBy": null,
          "neededDate": null,
          "lastCountedAt": null,
          "lastCountedBy": null,
          "lastUpdatedAt": null,
          "lastUpdatedBy": null
        }
      ],
      "summary": { "out": 0, "low": 0, "toBuy": 0, "onTheWay": 0, "unreviewed": 1 }
    }
  ]
}
```

## Errores

- `401`: clave ausente, inválida o revocada.
- `403`: clave válida sin el permiso `inventory:read` habilitado.
- `400`: ubicación inválida o vacía, parámetros duplicados o desconocidos. No se admiten claves en la consulta.
- `405`: método distinto de `GET`.
- `503`: inventario temporalmente no disponible. No sustituir los últimos datos válidos por ceros ni por un catálogo vacío.

Todas las respuestas, incluidos los errores, llevan `Cache-Control: no-store`. No se exportan correos, teléfonos, PINs, comentarios, notas privadas, recibos ni credenciales. Los nombres visibles de quien contó o actualizó solo aparecen en los campos indicados.

## Conexión y verificación

Guardar la clave exclusivamente en el servidor y habilitar el permiso antes de sincronizar. Reemplazar el estado de las localidades consultadas por cada respuesta válida; no acumular cantidades entre importaciones ni borrar Avondale al consultar solo Glendale.

Comparar contra Team por `location + id`: catálogo, estado, compra, entrega, cantidad y fecha del último conteo. Conservar valores desconocidos como `null`, mostrar la última sincronización válida y mantener los últimos datos válidos identificados como desactualizados si falla una consulta. Consultar o importar este reporte no confirma recepción ni realiza compras.
