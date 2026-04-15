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

//
app.post('/ventas', async (req, res) => {
    const {cliente_id, items, total} = req.body;

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
                'INSERT INTO ventas (cliente_id, total) VALUES (?, ?)',
                [cliente_id, total]
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
