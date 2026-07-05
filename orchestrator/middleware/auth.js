const jwt = require("jsonwebtoken");

const SECRET = "mi_clave_super_secreta";

function verificarToken(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).json({
            error: "Token no proporcionado"
        });
    }

    const token = authHeader.split(" ")[1];

    if (!token) {
        return res.status(401).json({
            error: "Token inválido"
        });
    }

    try {
        const usuario = jwt.verify(token, SECRET);

        req.usuario = usuario;

        next();
    } catch (err) {
        return res.status(401).json({
            error: "Token inválido o expirado"
        });
    }
}

module.exports = {
    verificarToken,
    SECRET
};