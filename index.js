const express = require('express'); //importo la librería express y la guardo en una variable constante
const app = express(); //ejecución de la función express(), se crea el servidor -> app

app.use(express.json()); //(app.use) agrega el middleware, (express.json()) convierte el JSON a un objeto JS 

// Endpoint de prueba
//Obtención de clientes
app.get('/clientes', (req, res) => { //(app.get) endpoint GET
    const clientes = [
        {id: 1, nombre: "Juan"}, //simulamos datos
        {id: 2, nombre: "María"}, 
    ];

    res.json(clientes); //envia datos en formato JSON, es decir devuelve los clientes al usuario
});

//Obtención de productos
app.get('/productos', (req, res) => {
    res.json([
        {id: 1, nombre: 'Speaker', precio: 120},
        {id: 2, nombre: 'TV', precio: 700},
        {id: 3, nombre: 'Camera', precio: 1000},
    ]);
});

//
app.post('/ventas', (req, res) => {
    const {cliente_id, items, total} = req.body;

    //VALIDACIÓN
    if(
        !cliente_id || 
        !Array.isArray(items) || 
        items.length === 0 || 
        total <= 0 ||
        items.some(item => !item.producto_id || item.cantidad <= 0)
    ) {
        return res.status(400).json({error: 'Datos incompletos o inválidos'});
    }

    console.log('VENTA RECIBIDA:');
    console.log(req.body);

    res.status(201).json({
        mensaje: 'Venta guardada correctamente',
    });
});

app.get('/depositos', (req, res) => {
    res.json([
        {id: 1, nombre: 'Central'},
        {id: 2, nombre: 'Sucursal'},
    ]);
});

app.listen(3000, '0.0.0.0', () => { //el servidor escucha en el puerto 3000 || () => {} función callback
    console.log('Servidor corriendo en http://localhost:3000');
})
