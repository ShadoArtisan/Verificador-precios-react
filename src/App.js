import React from 'react';

// Constantes de configuración de AWS Cognito y API Gateway
const COGNITO_DOMAIN = 'us-east-1ehrdobgi5.auth.us-east-1.amazoncognito.com';
const COGNITO_CLIENT_ID = '5f5au2pifdhpl45ujoeac09nd9';
const COGNITO_REDIRECT_URI = 'https://main.d2ax6decp23hvd.amplifyapp.com/';
const API_GATEWAY_URL = 'https://io1hs36q95.execute-api.us-east-1.amazonaws.com/dev';

/**
 * Componente principal de la aplicación.
 * Maneja la lógica de autenticación y renderiza la pantalla de Login o el Dashboard.
 */
function App() {
    // Este estado almacenará el ID Token del usuario, que es el que se usa para la autorización.
    const [token, setToken] = React.useState(null);
    const [userEmail, setUserEmail] = React.useState('');

    React.useEffect(() => {
        const hash = window.location.hash.substring(1);
        const params = new URLSearchParams(hash);
        
        // <-- CAMBIO: Ahora 'idToken' es la variable principal que buscamos.
        const idToken = params.get('id_token');

        // Si encontramos un idToken en la URL (después del login)
        if (idToken) {
            // <-- CAMBIO: El estado principal 'token' ahora es el idToken.
            setToken(idToken);
            
            // <-- CAMBIO: Guardamos el idToken en localStorage para persistir la sesión.
            localStorage.setItem('userIdToken', idToken);

            // Decodificamos el idToken para obtener el email del usuario.
            try {
                const payload = JSON.parse(atob(idToken.split('.')[1]));
                setUserEmail(payload.email);
                localStorage.setItem('userEmail', payload.email);
            } catch (e) {
                console.error("Error decodificando el id_token:", e);
            }
            
            // Limpiamos la URL para no mostrar los tokens.
            window.history.replaceState({}, document.title, window.location.pathname);

        // Si no hay token en la URL, buscamos en localStorage para ver si ya había una sesión.
        } else {
            // <-- CAMBIO: Buscamos 'userIdToken' en lugar de 'userAccessToken'.
            const storedToken = localStorage.getItem('userIdToken');
            const storedEmail = localStorage.getItem('userEmail');
            if (storedToken) {
                setToken(storedToken);
                setUserEmail(storedEmail);
            }
        }
    }, []);

    const handleLogin = () => {
        const cognitoLoginUrl = `https://${COGNITO_DOMAIN}/login?response_type=token&client_id=${COGNITO_CLIENT_ID}&redirect_uri=${encodeURIComponent(COGNITO_REDIRECT_URI)}`;
        window.location.href = cognitoLoginUrl;
    };

    const handleLogout = () => {
        setToken(null);
        setUserEmail('');
        // <-- CAMBIO: Removemos 'userIdToken' al cerrar sesión.
        localStorage.removeItem('userIdToken');
        localStorage.removeItem('userEmail');
        const cognitoLogoutUrl = `https://${COGNITO_DOMAIN}/logout?client_id=${COGNITO_CLIENT_ID}&logout_uri=${encodeURIComponent(COGNITO_REDIRECT_URI)}`;
        window.location.href = cognitoLogoutUrl;
    };

    return (
        <div className="bg-gray-900 text-white min-h-screen font-sans">
            {token ? (
                // Pasamos el ID Token al Dashboard para que lo use en las llamadas a la API.
                <Dashboard token={token} userEmail={userEmail} onLogout={handleLogout} />
            ) : (
                <LoginScreen onLogin={handleLogin} />
            )}
        </div>
    );
}


// ===============================================================
//  NO SE NECESITAN CAMBIOS EN LOS COMPONENTES DE ABAJO
// ===============================================================

/**
 * Pantalla que se muestra cuando el usuario no está autenticado.
 */
function LoginScreen({ onLogin }) {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4">
            <h1 className="text-4xl md:text-5xl font-bold text-cyan-400 mb-2">Verificador de Precios</h1>
            <p className="text-lg text-gray-400 mb-8">Mercado Libre Edition</p>
            <button
                onClick={onLogin}
                className="bg-cyan-500 hover:bg-cyan-600 text-white font-bold py-3 px-8 rounded-lg text-xl transition-transform transform hover:scale-105"
            >
                Iniciar Sesión / Registrarse
            </button>
            <p className="text-sm text-gray-500 mt-6">Serás redirigido a la página de inicio de sesión segura.</p>
        </div>
    );
}

/**
 * El Dashboard principal de la aplicación, visible después de iniciar sesión.
 */
function Dashboard({ token, userEmail, onLogout }) {
    const [products, setProducts] = React.useState([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [newProductUrl, setNewProductUrl] = React.useState('');
    const [newProductThreshold, setNewProductThreshold] = React.useState('');
    const [error, setError] = React.useState(null);

    const fetchProducts = React.useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await fetch(`${API_GATEWAY_URL}/products`, {
                method: 'GET',
                headers: {
                    // Ahora 'token' es el ID Token, que es lo correcto.
                    'Authorization': `${token}` // El 'authorizer' de Cognito procesa esto correctamente.
                }
            });
            if (!response.ok) {
                throw new Error(`Error ${response.status}: No se pudo obtener la lista de productos.`);
            }
            const data = await response.json();
            setProducts(data);
        } catch (err) {
            setError(err.message);
            console.error("Error en fetchProducts:", err);
        } finally {
            setIsLoading(false);
        }
    }, [token]);

    React.useEffect(() => {
        fetchProducts();
    }, [fetchProducts]);

    const handleAddProduct = async (e) => {
        e.preventDefault();
        if (!newProductUrl || !newProductThreshold) {
            setError("Por favor, completa la URL y el precio deseado.");
            return;
        }
        
        setError(null);
        try {
            const response = await fetch(`${API_GATEWAY_URL}/products`, {
                method: 'POST',
                headers: {
                    'Authorization': `${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    url: newProductUrl,
                    threshold: parseFloat(newProductThreshold)
                })
            });

            if (!response.ok) {
                 const errorData = await response.json().catch(() => ({}));
                 throw new Error(errorData.message || `Error ${response.status}: No se pudo agregar el producto.`);
            }
            
            setNewProductUrl('');
            setNewProductThreshold('');
            fetchProducts();

        } catch (err) {
            setError(err.message);
            console.error("Error en handleAddProduct:", err);
        }
    };

    const handleDeleteProduct = async (productId) => {
        const originalProducts = [...products];
        setProducts(products.filter(p => p.ProductID !== productId));

        try {
            const response = await fetch(`${API_GATEWAY_URL}/products/${productId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `${token}`
                }
            });

            if (!response.ok) {
                setProducts(originalProducts);
                throw new Error(`Error ${response.status}: No se pudo eliminar el producto.`);
            }
        } catch (err) {
            setError(err.message);
            console.error("Error en handleDeleteProduct:", err);
        }
    };

    return (
        <div className="container mx-auto p-4 md:p-8">
            <header className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-cyan-400">Mi Dashboard</h1>
                    <p className="text-gray-400">{userEmail}</p>
                </div>
                <button onClick={onLogout} className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-lg transition">
                    Cerrar Sesión
                </button>
            </header>

            <div className="bg-gray-800 p-6 rounded-lg mb-8">
                <h2 className="text-2xl font-semibold mb-4">Agregar Nuevo Producto</h2>
                <form onSubmit={handleAddProduct} className="flex flex-col md:flex-row gap-4">
                    <input
                        type="url"
                        placeholder="Pega la URL del producto de Mercado Libre"
                        value={newProductUrl}
                        onChange={(e) => setNewProductUrl(e.target.value)}
                        className="flex-grow bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                        required
                    />
                    <input
                        type="number"
                        placeholder="Precio deseado (ej: 15000)"
                        value={newProductThreshold}
                        onChange={(e) => setNewProductThreshold(e.target.value)}
                        className="bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                        required
                    />
                    <button type="submit" className="bg-cyan-500 hover:bg-cyan-600 text-white font-bold py-2 px-6 rounded-lg transition">
                        Agregar
                    </button>
                </form>
                {error && <p className="text-red-400 mt-4">{error}</p>}
            </div>

            <div>
                <h2 className="text-2xl font-semibold mb-4">Mis Productos Seguidos</h2>
                {isLoading ? (
                    <p className="text-gray-400">Cargando productos...</p>
                ) : products.length === 0 ? (
                    <p className="text-gray-400">Aún no estás siguiendo ningún producto. ¡Agrega uno!</p>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {products.map(product => (
                            <ProductCard key={product.ProductID} product={product} onDelete={handleDeleteProduct} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

function ProductCard({ product, onDelete }) {
    const getIndicatorColor = () => {
        const price = parseFloat(product.lastCheckedPrice);
        const threshold = parseFloat(product.threshold);
        if (price < threshold) return 'bg-green-500';
        if (price === threshold) return 'bg-blue-500';
        return 'bg-yellow-500';
    };
    
    const indicatorColor = getIndicatorColor();

    return (
        <div className="bg-gray-800 rounded-lg shadow-lg p-5 flex flex-col justify-between transition-transform transform hover:-translate-y-1">
            <div>
                <div className="flex justify-between items-start">
                    <a href={product.url} target="_blank" rel="noopener noreferrer" className="text-lg font-bold text-gray-200 hover:text-cyan-400 pr-4 flex-1">
                        {product.title}
                    </a>
                    <div className={`w-4 h-4 rounded-full ${indicatorColor} flex-shrink-0 mt-1`} title={`Estado del precio`}></div>
                </div>
                <div className="mt-4 text-gray-400">
                    <p>Precio Actual: <span className="font-semibold text-white">${new Intl.NumberFormat('es-AR').format(product.lastCheckedPrice)}</span></p>
                    <p>Precio Deseado: <span className="font-semibold text-white">${new Intl.NumberFormat('es-AR').format(product.threshold)}</span></p>
                </div>
            </div>
            <button 
                onClick={() => onDelete(product.ProductID)} 
                className="mt-6 bg-red-800 hover:bg-red-700 text-white text-sm font-bold py-2 px-4 rounded-lg w-full transition"
            >
                Dejar de seguir
            </button>
        </div>
    );
}

export default App;