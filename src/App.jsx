import { useEffect, useState } from "react";
import "./App.css";

const API_URL = "https://altamia-christannlhoyd-new.onrender.com/api";

function App() {
  const [token, setToken] = useState(
    localStorage.getItem("access_token")
  );

  const [username, setUsername] = useState(
    localStorage.getItem("username") || ""
  );

  const [products, setProducts] = useState([]);

  const [loginForm, setLoginForm] = useState({
    username: "",
    password: ""
  });

  const [productForm, setProductForm] = useState({
    product_name: "",
    description: "",
    price: "",
    quantity: ""
  });

  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  // =========================
  // LOGIN
  // =========================

  const login = async (e) => {
    e.preventDefault();

    setError("");
    setMessage("");

    try {
      const response = await fetch(`${API_URL}/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify(loginForm)
      });

      const text = await response.text();

      let data = {};

      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        throw new Error(
          `API returned an invalid response. Status: ${response.status}`
        );
      }

      if (!response.ok) {
        throw new Error(
          data.message ||
          data.error ||
          `Login failed. Status: ${response.status}`
        );
      }

      const accessToken =
        data.access_token ||
        data.data?.access_token ||
        data.tokens?.access_token;

      if (!accessToken) {
        throw new Error("No access token received from API.");
      }

      localStorage.setItem("access_token", accessToken);
      localStorage.setItem("username", loginForm.username);

      setToken(accessToken);
      setUsername(loginForm.username);

      setLoginForm({
        username: "",
        password: ""
      });

      setMessage("Login successful.");

    } catch (err) {
      console.error("LOGIN ERROR:", err);
      setError(err.message || "Failed to fetch.");
    }
  };

  // =========================
  // GET PRODUCTS
  // =========================

  const getProducts = async () => {
    if (!token) {
      return;
    }

    try {
      const response = await fetch(`${API_URL}/products`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json"
        }
      });

      const text = await response.text();

      let data = {};

      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        throw new Error(
          `API returned an invalid response. Status: ${response.status}`
        );
      }

      if (!response.ok) {
        throw new Error(
          data.message ||
          data.error ||
          `Failed to load products. Status: ${response.status}`
        );
      }

      const productList =
        data.products ||
        data.data?.products ||
        data.data ||
        [];

      setProducts(productList);

    } catch (err) {
      console.error("GET PRODUCTS ERROR:", err);
      setError(err.message || "Failed to load products.");
    }
  };

  useEffect(() => {
    if (token) {
      getProducts();
    }
  }, [token]);

  // =========================
  // FORM INPUT
  // =========================

  const handleProductChange = (e) => {
    setProductForm({
      ...productForm,
      [e.target.name]: e.target.value
    });
  };

  // =========================
  // ADD PRODUCT
  // =========================

  const addProduct = async (e) => {
    e.preventDefault();

    setError("");
    setMessage("");

    try {
      const response = await fetch(`${API_URL}/products`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          product_name: productForm.product_name,
          description: productForm.description,
          price: Number(productForm.price),
          quantity: Number(productForm.quantity)
        })
      });

      const text = await response.text();

      let data = {};

      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        throw new Error(
          `API returned an invalid response. Status: ${response.status}`
        );
      }

      if (!response.ok) {
        throw new Error(
          data.message ||
          data.error ||
          `Failed to add product. Status: ${response.status}`
        );
      }

      setMessage("Product added successfully.");

      clearForm();
      getProducts();

    } catch (err) {
      console.error("ADD PRODUCT ERROR:", err);
      setError(err.message || "Failed to add product.");
    }
  };

  // =========================
  // EDIT PRODUCT
  // =========================

  const editProduct = (product) => {
    setEditingId(product.id);

    setProductForm({
      product_name: product.product_name,
      description: product.description,
      price: product.price,
      quantity: product.quantity
    });

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  };

  // =========================
  // UPDATE PRODUCT
  // =========================

  const updateProduct = async (e) => {
    e.preventDefault();

    setError("");
    setMessage("");

    try {
      const response = await fetch(
        `${API_URL}/products/${editingId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            product_name: productForm.product_name,
            description: productForm.description,
            price: Number(productForm.price),
            quantity: Number(productForm.quantity)
          })
        }
      );

      const text = await response.text();

      let data = {};

      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        throw new Error(
          `API returned an invalid response. Status: ${response.status}`
        );
      }

      if (!response.ok) {
        throw new Error(
          data.message ||
          data.error ||
          `Failed to update product. Status: ${response.status}`
        );
      }

      setMessage("Product updated successfully.");

      clearForm();
      getProducts();

    } catch (err) {
      console.error("UPDATE PRODUCT ERROR:", err);
      setError(err.message || "Failed to update product.");
    }
  };

  // =========================
  // DELETE PRODUCT
  // =========================

  const deleteProduct = async (id) => {
    const confirmDelete = window.confirm(
      "Are you sure you want to delete this product?"
    );

    if (!confirmDelete) {
      return;
    }

    setError("");
    setMessage("");

    try {
      const response = await fetch(
        `${API_URL}/products/${id}`,
        {
          method: "DELETE",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`
          }
        }
      );

      const text = await response.text();

      let data = {};

      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        throw new Error(
          `API returned an invalid response. Status: ${response.status}`
        );
      }

      if (!response.ok) {
        throw new Error(
          data.message ||
          data.error ||
          `Failed to delete product. Status: ${response.status}`
        );
      }

      setMessage("Product deleted successfully.");

      getProducts();

    } catch (err) {
      console.error("DELETE PRODUCT ERROR:", err);
      setError(err.message || "Failed to delete product.");
    }
  };

  // =========================
  // CLEAR FORM
  // =========================

  const clearForm = () => {
    setProductForm({
      product_name: "",
      description: "",
      price: "",
      quantity: ""
    });

    setEditingId(null);
  };

  // =========================
  // LOGOUT
  // =========================

  const logout = async () => {
    try {
      await fetch(`${API_URL}/logout`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`
        }
      });
    } catch (error) {
      console.log("Logout request failed.");
    }

    localStorage.removeItem("access_token");
    localStorage.removeItem("username");

    setToken(null);
    setUsername("");
    setProducts([]);
    clearForm();
    setError("");
    setMessage("");
  };

  // =========================
  // LOGIN PAGE
  // =========================

  if (!token) {
    return (
      <div className="login-page">
        <div className="login-box">

          <h1>Product Management</h1>

          <p className="subtitle">
            Laboratory Exercise No. 6
          </p>

          <form onSubmit={login}>

            <label>Username</label>

            <input
              type="text"
              value={loginForm.username}
              onChange={(e) =>
                setLoginForm({
                  ...loginForm,
                  username: e.target.value
                })
              }
              placeholder="Enter username"
              required
            />

            <label>Password</label>

            <input
              type="password"
              value={loginForm.password}
              onChange={(e) =>
                setLoginForm({
                  ...loginForm,
                  password: e.target.value
                })
              }
              placeholder="Enter password"
              required
            />

            <button type="submit">
              Login
            </button>

          </form>

          {error && (
            <p className="error">
              {error}
            </p>
          )}

          {message && (
            <p className="success">
              {message}
            </p>
          )}

        </div>
      </div>
    );
  }

  // =========================
  // PRODUCT PAGE
  // =========================

  return (
    <div className="app">

      <header className="header">

        <div>
          <h1>Product Management</h1>

          <p>
            Welcome, {username}
          </p>
        </div>

        <button
          className="logout-button"
          onClick={logout}
        >
          Logout
        </button>

      </header>

      <main>

        {error && (
          <div className="error-box">
            {error}
          </div>
        )}

        {message && (
          <div className="success-box">
            {message}
          </div>
        )}

        {/* PRODUCT FORM */}

        <section className="form-section">

          <h2>
            {editingId
              ? "Edit Product"
              : "Add Product"}
          </h2>

          <form
            onSubmit={
              editingId
                ? updateProduct
                : addProduct
            }
          >

            <input
              type="text"
              name="product_name"
              value={productForm.product_name}
              onChange={handleProductChange}
              placeholder="Product name"
              required
            />

            <textarea
              name="description"
              value={productForm.description}
              onChange={handleProductChange}
              placeholder="Description"
              required
            />

            <input
              type="number"
              name="price"
              value={productForm.price}
              onChange={handleProductChange}
              placeholder="Price"
              step="0.01"
              min="0"
              required
            />

            <input
              type="number"
              name="quantity"
              value={productForm.quantity}
              onChange={handleProductChange}
              placeholder="Quantity"
              min="0"
              required
            />

            <div className="form-buttons">

              <button type="submit">
                {editingId
                  ? "Update Product"
                  : "Add Product"}
              </button>

              {editingId && (
                <button
                  type="button"
                  className="cancel-button"
                  onClick={clearForm}
                >
                  Cancel
                </button>
              )}

            </div>

          </form>

        </section>

        {/* PRODUCT LIST */}

        <section className="products-section">

          <h2>Product List</h2>

          {products.length === 0 ? (
            <p>No products found.</p>
          ) : (

            <div className="table-container">

              <table>

                <thead>

                  <tr>
                    <th>ID</th>
                    <th>Product Name</th>
                    <th>Description</th>
                    <th>Price</th>
                    <th>Quantity</th>
                    <th>Actions</th>
                  </tr>

                </thead>

                <tbody>

                  {products.map((product) => (

                    <tr key={product.id}>

                      <td>
                        {product.id}
                      </td>

                      <td>
                        {product.product_name}
                      </td>

                      <td>
                        {product.description}
                      </td>

                      <td>
                        ₱{Number(product.price).toFixed(2)}
                      </td>

                      <td>
                        {product.quantity}
                      </td>

                      <td>

                        <button
                          className="edit-button"
                          onClick={() =>
                            editProduct(product)
                          }
                        >
                          Edit
                        </button>

                        <button
                          className="delete-button"
                          onClick={() =>
                            deleteProduct(product.id)
                          }
                        >
                          Delete
                        </button>

                      </td>

                    </tr>

                  ))}

                </tbody>

              </table>

            </div>

          )}

        </section>

      </main>

    </div>
  );
}

export default App;