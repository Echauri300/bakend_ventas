const mysql = require('mysql2/promise');

const poolPos = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'pos_app',
});

const poolPega = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'pega_pruebas',
});

module.exports = {
    poolPos,
    poolPega
};

