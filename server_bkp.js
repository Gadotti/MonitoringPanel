const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const port = 3123;

// Middleware para servir arquivos estáticos
app.use(express.static('public'));
app.use(express.json());

// Caminho do arquivo de configuração
const configFile = path.join(__dirname, 'public', 'layout.config.json');

// Endpoint para obter o layout salvo
app.get('/api/layout', (req, res) => {
    fs.readFile(configFile, 'utf8', (err, data) => {
        if (err) {
            console.error('Erro ao ler o layout:', err);
            return res.json({});
        }
        try {
            const json = JSON.parse(data);
            res.json(json);
        } catch (e) {
            res.json({});
        }
    });
});

// Endpoint para salvar o layout
app.post('/api/layout', (req, res) => {
    const layout = req.body;
    fs.writeFile(configFile, JSON.stringify(layout, null, 2), (err) => {
        if (err) {
            console.error('Erro ao salvar o layout:', err);
            return res.status(500).send('Erro ao salvar');
        }
        res.send('Layout salvo com sucesso');
    });
});

app.listen(port, () => {
    console.log(`Servidor rodando em http://localhost:${port}`);
});
