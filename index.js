const express = require('express'); //importo la librería express y la guardo en una variable constante
const app = express(); //ejecución de la función express(), se crea el servidor -> app
const pool = require('./db');
const mysql = require('mysql2/promise');

// const pool = mysql.createPool({
//     host: 'localhost',
//     user: 'root',
//     password: '',
//     database: 'pos_app',
// })

//prueba de conexión a la BD
app.get('/test-db', async (req, res) => { //crea un endpoint de prueba
    try {
        const [rows] = await pool.query('SELECT 1'); //Ejecuta una query simple para verificar conexión.
        res.json({ ok: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error de conexión'});
    }
});

app.use(express.json()); //(app.use) agrega el middleware, (express.json()) convierte el JSON a un objeto JS 

// Endpoint de prueba
//Obtención de clientes
app.get('/clientes', async (req, res) => { //(app.get) endpoint GET
    try {
        const [rows] = await pool.query('SELECT * FROM clientes');
        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener clientes' });
    }
});

//Busqueda de cliente
app.get('/clientes/search', async (req, res) => {
    const {q} = req.query;

    try {
        const [rows] = await pool.query(
            `SELECT * FROM clientes 
             WHERE nombre LIKE ?
             LIMIT 10`,
             [`%${q}%`]
        );
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: 'Error buscando clientes'});
    }
})

// //Obtención de productos
// app.get('/productos', async (req, res) => {
//     try {
//         const [rows] = await pool.query('SELECT * FROM productos');
//         res.json(rows);
//     } catch (error) { 
//         console.error(error);
//         res.status(500).json({ error: 'Error al obtener productos' });
//     }
// });

app.get('/productos', async (req, res) => {
    try {
        const {q} = req.query;

        let query = 'SELECT id, nombre, precio FROM productos';
        let params = [];

        if (q) {
            query += ' WHERE LOWER(nombre) LIKE ?';
            params.push(`%${q.toLocaleLowerCase()}`);
        }

        const [rows] = await pool.query(query, params);

        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error en servidor' });
    }
});

//
app.post('/ventas', async (req, res) => {
    const {cliente_id, items, total} = req.body;

    //VALIDACIÓN
    if(
        !cliente_id || 
        !Array.isArray(items) || 
        items.length === 0 || 
        total <= 0 
        // items.some(item => !item.producto_id || item.cantidad <= 0)
    ) {
        return res.status(400).json({error: 'Datos incompletos o inválidos'});
    }

        //1. GUARDAR VENTA
        try { 
            const [result] = await pool.query(
                'INSERT INTO ventas (cliente_id, total) VALUE (?, ?)',
                [cliente_id, total]
            );

            const ventaId = result.insertId;

            //2. GUARDAR DETALLES
            for (const item of items){ //recorre el array de producto en este caso
                await pool.query(
                    'INSERT INTO venta_detalles (venta_id, producto_id, cantidad) VALUES (?, ?, ?)',
                    [ventaId, item.producto_id, item.cantidad]
                );
            }

            res.status(201).json({
                mensaje: 'Venta guardada',
                ventaId,
            });

        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Error al guardar venta'});
        } 

});

app.get('/depositos', async (req, res) => {
    try { 
        const [rows] = await pool.query('SELECT * FROM depositos');
        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener depositos'});
    }
});

app.listen(3000, '0.0.0.0', () => { //el servidor escucha en el puerto 3000 || () => {} función callback
    console.log('Servidor corriendo en http://localhost:3000');
})
