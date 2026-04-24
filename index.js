const express = require('express'); //importo la librería express y la guardo en una variable constante
const app = express(); //ejecución de la función express(), se crea el servidor -> app

const mysql = require('mysql2/promise');

const {poolPos, poolPega} = require('./db');

//prueba de conexión a la BD
app.get('/test-db', async (req, res) => { //crea un endpoint de prueba
    try {
        const [rows] = await poolPega.query('SELECT * FROM clientes LIMIT 1'); //Ejecuta una query simple para verificar conexión.
        res.json({ rows});
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error de conexión'});
    }
});

app.use(express.json()); //(app.use) agrega el middleware, (express.json()) convierte el JSON a un objeto JS 

//Busqueda vendedores
app.get('/vendedores/search', async (req, res) => {
    const {q} = req.query;
    
    try{
        const [rows] = await poolPega.query(`
            SELECT 
                cod_vendedor, 
                nombre_apellido
            FROM pega_pruebas.vendedores
            WHERE nombre_apellido LIKE ? 
            LIMIT 10 
            `,
            [`%${q}%`]
        );
        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error buscando vendedores'});
    }
});

//Busqueda clientes
app.get('/clientes/search', async (req, res) => {
    const { q } = req.query;

    try {
        const [rows] = await poolPega.query(`
            SELECT 
                cod_cliente AS id,
                nombre_cliente AS nombre
            FROM clientes
            WHERE nombre_cliente LIKE ?
            LIMIT 10
        `, [`%${q}%`]);

        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error buscando clientes'});
    }
});

//Busqueda productos
app.get('/productos', async (req, res) => {
    try {
        const {q} = req.query;

        let query = `SELECT 
                    codigo,
                    descripcion_producto AS nombre,
                    precio_costo + 0 AS precio
                    FROM productos`;
        let params = [];

        if (q) {
            // query += ' WHERE LOWER(nombre) LIKE ?';
            query += ' WHERE descripcion_producto LIKE ? LIMIT 10';
            params.push(`%${q}%`);
        }

        const [rows] = await poolPega.query(query, params);

        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error en servidor' });
    }
});

//Crear venta
app.post('/ventas', async (req, res) => {
    const {cliente_id, vendedor_id, items, total} = req.body;

    //VALIDACIÓN
    if(
        !cliente_id || 
        !Array.isArray(items) || 
        items.length === 0 || 
        total <= 0 || 
        items.some(item => !item.producto_id || item.cantidad <= 0) //ultima q se volvio a activar
    ) {
        return res.status(400).json({error: 'Datos incompletos o inválidos'});
    }

        const connection = await poolPos.getConnection();

        
        try { 
            await connection.beginTransaction();
            //1. GUARDAR VENTA
            const [result] = await connection.query(
                'INSERT INTO ventas (cliente_id, vendedor_id, total) VALUES (?, ?, ?)',
                [cliente_id, vendedor_id, total]
            );

            const ventaId = result.insertId;

            //2. GUARDAR DETALLES
            for (const item of items){ //recorre el array de producto en este caso
                await connection.query(
                    'INSERT INTO pos_app.venta_detalles (venta_id, producto_id, cantidad) VALUES (?, ?, ?)',
                    [ventaId, item.producto_id, item.cantidad]
                );
            }

            await connection.commit();

            res.status(201).json({
                mensaje: 'Venta guardada',
                ventaId,
            });

        } catch (error) {
            await connection.rollback();
            console.error(error);
            res.status(500).json({ error: 'Error al guardar venta'});
        } finally {
            connection.release();
        }

});

//Listar ventas
app.get('/ventas', async (req, res) => {
    try {
        const [rows] = await poolPos.query(`
            SELECT 
                v.id, 
                v.cliente_id, 
                v.vendedor_id,
                v.total,
                v.fecha,
                c.nombre_cliente as cliente_nombre,
                ven.nombre_apellido as vendedor_nombre
            FROM ventas v
            LEFT JOIN pega_pruebas.clientes c
                ON c.cod_cliente = v.cliente_id
            LEFT JOIN pega_pruebas.vendedores ven
                ON ven.cod_vendedor = v.vendedor_id
            ORDER BY v.id DESC
        `);
        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({error: 'Error obteniendo ventas'});
    }
});

//Detalle de una venta
app.get('/ventas/:id', async (req, res) => {
    const {id} = req.params;

    try {
        const [rows] = await poolPos.query(`
            SELECT
                vd.cantidad,
                p.codigo,
                p.descripcion_producto,
                p.precio_costo
            FROM pos_app.venta_detalles vd
            JOIN pega_pruebas.productos p ON p.codigo = vd.producto_id
            WHERE vd.venta_id = ?    
        `, [id]);

        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({error: 'Error obteniendo detalle'});
    }
});

//Mostrar estadisticas de ventas
app.get('/ventas/stats/:vendedorId', async (req, res) => {
    const {vendedorId} = req.params;
    const {rango = 'hoy'} = req.query;

    let condicionFecha = '';

    if (rango == 'hoy') {
        condicionFecha = 'DATE(fecha) = CURDATE()';
    } else if (rango == 'semana') {
        condicionFecha = 'YEARWEEK(fecha, 1) = YEARWEEK(CURDATE(), 1)';
    } else if (rango == 'mes') {
        condicionFecha = 'MONTH(fecha)  = MONTH(CURDATE()) AND YEAR(fecha) = YEAR(CURDATE())';
    }

    try { 
        const [rows] = await poolPos.query(`
            SELECT
                COUNT(*) as cantidad_ventas,  
                COALESCE(SUM(total), 0) as total_vendido
            FROM ventas
            WHERE vendedor_id = ?
            AND ${condicionFecha}
        `,  [vendedorId]);

        res.json(rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error obteniendo stats' });
    }
});

//Listar depositos
app.get('/depositos', async (req, res) => {
    try { 
        const [rows] = await poolPos.query('SELECT * FROM depositos');
        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener depositos'});
    }
});

app.listen(3000, '0.0.0.0', () => { //el servidor escucha en el puerto 3000 || () => {} función callback
    console.log('Servidor corriendo en http://localhost:3000');
})
