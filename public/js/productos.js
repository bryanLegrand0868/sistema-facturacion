document.addEventListener('DOMContentLoaded', function() {
    const modal = new bootstrap.Modal(document.getElementById('nuevoProductoModal'));
    const formProducto = document.getElementById('formProducto');
    const buscarProducto = document.getElementById('buscarProducto');
    let timeoutId;
    
    // Verificar stock bajo al cargar la página
    verificarProductosConStockBajo();
    
    // Manejar búsqueda de productos con debounce
    buscarProducto.addEventListener('input', function(e) {
        const searchTerm = e.target.value.toLowerCase();
        
        // Limpiar el timeout anterior
        clearTimeout(timeoutId);
        
        // Si el término de búsqueda está vacío, mostrar todos los productos
        if (!searchTerm) {
            document.querySelectorAll('#productosTabla tr').forEach(row => {
                row.style.display = '';
            });
            return;
        }
        
        // Esperar 300ms antes de realizar la búsqueda
        timeoutId = setTimeout(() => {
            document.querySelectorAll('#productosTabla tr').forEach(row => {
                const codigo = row.cells[0].textContent.toLowerCase();
                const nombre = row.cells[1].textContent.toLowerCase();
                row.style.display = 
                    codigo.includes(searchTerm) || nombre.includes(searchTerm) 
                        ? '' 
                        : 'none';
            });
        }, 300);
    });

    // Verificar stock cuando se cambian los valores
    const stockActual = document.getElementById('stockActual');
    const stockMinimo = document.getElementById('stockMinimo');
    const alertaStock = document.getElementById('alertaStock');
    
    if (stockActual && stockMinimo) {
        stockActual.addEventListener('input', verificarStock);
        stockMinimo.addEventListener('input', verificarStock);
    }
    
    function verificarStock() {
        const actual = parseFloat(stockActual.value) || 0;
        const minimo = parseFloat(stockMinimo.value) || 0;
        
        if (minimo > 0 && actual <= minimo) {
            alertaStock.classList.remove('d-none');
            alertaStock.innerHTML = `
                <i class="bi bi-exclamation-triangle-fill me-2"></i>
                <strong>Advertencia:</strong> El stock actual (${actual}) es menor o igual al stock mínimo establecido (${minimo}).
            `;
        } else {
            alertaStock.classList.add('d-none');
        }
    }

    // Teclas rápidas
    document.addEventListener('keydown', function(e) {
        // Evitar que las teclas rápidas se activen cuando se está escribiendo en un input
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
            return;
        }

        if (e.ctrlKey || e.metaKey) { // Ctrl en Windows/Linux o Cmd en Mac
            switch(e.key.toLowerCase()) {
                case 'b': // Ctrl/Cmd + B para buscar producto
                    e.preventDefault();
                    buscarProducto.focus();
                    break;
                case 'n': // Ctrl/Cmd + N para nuevo producto
                    e.preventDefault();
                    abrirModalNuevoProducto();
                    break;
            }
        } else if (!e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
            // Tecla '/' para buscar (sin modificadores)
            if (e.key === '/') {
                e.preventDefault();
                buscarProducto.focus();
            }
        }
    });

    // Función para abrir modal de nuevo producto
    function abrirModalNuevoProducto() {
        document.getElementById('productoId').value = '';
        formProducto.reset();
        document.getElementById('modalTitle').textContent = 'Nuevo Producto';
        alertaStock.classList.add('d-none');
        modal.show();
        setTimeout(() => {
            document.getElementById('codigo').focus();
        }, 500);
    }

    // Manejar guardado de producto
    document.getElementById('guardarProducto').addEventListener('click', async function() {
        if (!formProducto.checkValidity()) {
            formProducto.reportValidity();
            return;
        }

        const productoData = {
            codigo: document.getElementById('codigo').value.trim(),
            nombre: document.getElementById('nombre').value.trim(),
            precio_kg: parseFloat(document.getElementById('precioKg').value) || 0,
            precio_unidad: parseFloat(document.getElementById('precioUnidad').value) || 0,
            precio_libra: parseFloat(document.getElementById('precioLibra').value) || 0,
            stock_actual: parseFloat(document.getElementById('stockActual').value) || 0,
            stock_minimo: parseFloat(document.getElementById('stockMinimo').value) || 0
        };

        const productoId = document.getElementById('productoId').value;
        const url = productoId ? `/productos/${productoId}` : '/productos';
        const method = productoId ? 'PUT' : 'POST';

        try {
            const response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(productoData)
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Error al guardar el producto');
            }

            // Mostrar mensaje de éxito
            mostrarAlerta(
                productoId ? 'Producto actualizado exitosamente' : 'Producto creado exitosamente', 
                'success'
            );
            
            modal.hide();
            
            // Recargar la página después de un breve delay
            setTimeout(() => {
                location.reload();
            }, 1500);
            
        } catch (error) {
            mostrarAlerta(error.message, 'danger');
        }
    });

    // Limpiar formulario al cerrar el modal
    document.getElementById('nuevoProductoModal').addEventListener('hidden.bs.modal', function() {
        document.getElementById('productoId').value = '';
        formProducto.reset();
        document.getElementById('modalTitle').textContent = 'Nuevo Producto';
        alertaStock.classList.add('d-none');
    });

    // Agregar tooltips para mostrar las teclas rápidas
    const tooltips = [
        { 
            element: buscarProducto, 
            title: 'Teclas rápidas: Ctrl+B o /'
        },
        {
            element: document.querySelector('[data-bs-target="#nuevoProductoModal"]'),
            title: 'Tecla rápida: Ctrl+N'
        }
    ];

    tooltips.forEach(({element, title}) => {
        if (element) {
            element.setAttribute('title', title);
            new bootstrap.Tooltip(element);
        }
    });

    // Verificar productos con stock bajo al cargar
    function verificarProductosConStockBajo() {
        const rows = document.querySelectorAll('#productosTabla tr');
        let productosConStockBajo = 0;
        
        rows.forEach(row => {
            const stockActual = parseFloat(row.cells[5]?.textContent) || 0;
            const stockMinimo = parseFloat(row.cells[6]?.textContent) || 0;
            
            if (stockMinimo > 0 && stockActual <= stockMinimo) {
                productosConStockBajo++;
            }
        });
        
        if (productosConStockBajo > 0) {
            mostrarNotificacionStockBajo(productosConStockBajo);
        }
    }

    // Mostrar notificación de productos con stock bajo
    function mostrarNotificacionStockBajo(cantidad) {
        const toastHtml = `
            <div class="toast position-fixed bottom-0 end-0 m-3" role="alert" data-bs-autohide="false" style="z-index: 9999;">
                <div class="toast-header bg-warning text-dark">
                    <i class="bi bi-exclamation-triangle-fill me-2"></i>
                    <strong class="me-auto">Alerta de Inventario</strong>
                    <button type="button" class="btn-close" data-bs-dismiss="toast"></button>
                </div>
                <div class="toast-body">
                    <strong>${cantidad}</strong> producto(s) tienen stock bajo o están en el mínimo.
                    <div class="mt-2">
                        <button type="button" class="btn btn-sm btn-warning" onclick="filtrarProductosStockBajo()">
                            Ver productos
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        // Remover toast anterior si existe
        const toastExistente = document.querySelector('.toast');
        if (toastExistente) {
            toastExistente.remove();
        }
        
        document.body.insertAdjacentHTML('beforeend', toastHtml);
        const toastElement = document.querySelector('.toast');
        const toast = new bootstrap.Toast(toastElement);
        toast.show();
    }
});

// Función para editar producto (fuera del DOMContentLoaded para ser accesible globalmente)
function editarProducto(id) {
    fetch(`/productos/${id}`)
        .then(response => {
            if (!response.ok) {
                throw new Error('Error al cargar el producto');
            }
            return response.json();
        })
        .then(producto => {
            // Llenar el formulario con los datos del producto
            document.getElementById('productoId').value = producto.id;
            document.getElementById('codigo').value = producto.codigo;
            document.getElementById('nombre').value = producto.nombre;
            document.getElementById('precioKg').value = producto.precio_kg || 0;
            document.getElementById('precioUnidad').value = producto.precio_unidad || 0;
            document.getElementById('precioLibra').value = producto.precio_libra || 0;
            document.getElementById('stockActual').value = producto.stock_actual || 0;
            document.getElementById('stockMinimo').value = producto.stock_minimo || 0;
            
            // Verificar si hay alerta de stock
            const actual = parseFloat(producto.stock_actual) || 0;
            const minimo = parseFloat(producto.stock_minimo) || 0;
            const alertaStock = document.getElementById('alertaStock');
            
            if (minimo > 0 && actual <= minimo) {
                alertaStock.classList.remove('d-none');
                alertaStock.innerHTML = `
                    <i class="bi bi-exclamation-triangle-fill me-2"></i>
                    <strong>Advertencia:</strong> El stock actual (${actual}) es menor o igual al stock mínimo establecido (${minimo}).
                `;
            } else {
                alertaStock.classList.add('d-none');
            }
            
            // Cambiar título del modal y mostrarlo
            document.getElementById('modalTitle').textContent = 'Editar Producto';
            const modal = new bootstrap.Modal(document.getElementById('nuevoProductoModal'));
            modal.show();
        })
        .catch(error => {
            mostrarAlerta('Error al cargar el producto: ' + error.message, 'danger');
        });
}

// Función para eliminar producto
function eliminarProducto(id) {
    // Usar SweetAlert2 si está disponible, si no, usar confirm nativo
    if (typeof Swal !== 'undefined') {
        Swal.fire({
            title: '¿Está seguro?',
            text: "Esta acción no se puede deshacer",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Sí, eliminar',
            cancelButtonText: 'Cancelar'
        }).then((result) => {
            if (result.isConfirmed) {
                procesarEliminacion(id);
            }
        });
    } else {
        if (confirm('¿Está seguro de eliminar este producto?\n\nEsta acción no se puede deshacer.')) {
            procesarEliminacion(id);
        }
    }
}

// Función auxiliar para procesar la eliminación
function procesarEliminacion(id) {
    fetch(`/productos/${id}`, {
        method: 'DELETE'
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(data => {
                throw new Error(data.error || 'Error al eliminar el producto');
            });
        }
        return response.json();
    })
    .then(() => {
        mostrarAlerta('Producto eliminado exitosamente', 'success');
        setTimeout(() => {
            location.reload();
        }, 1500);
    })
    .catch(error => {
        mostrarAlerta(error.message, 'danger');
    });
}

// Función para mostrar alertas
function mostrarAlerta(mensaje, tipo) {
    const alertHtml = `
        <div class="alert alert-${tipo} alert-dismissible fade show position-fixed top-0 start-50 translate-middle-x mt-3" 
             style="z-index: 9999; min-width: 300px; box-shadow: 0 0.5rem 1rem rgba(0,0,0,0.15);">
            ${tipo === 'success' ? '<i class="bi bi-check-circle-fill me-2"></i>' : '<i class="bi bi-exclamation-triangle-fill me-2"></i>'}
            ${mensaje}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        </div>
    `;
    
    // Remover alerta anterior si existe
    const alertaExistente = document.querySelector('.alert.position-fixed');
    if (alertaExistente) {
        alertaExistente.remove();
    }
    
    document.body.insertAdjacentHTML('beforeend', alertHtml);
    
    // Auto-ocultar después de 5 segundos
    setTimeout(() => {
        const alert = document.querySelector('.alert.position-fixed');
        if (alert) {
            alert.classList.remove('show');
            setTimeout(() => alert.remove(), 300);
        }
    }, 5000);
}

// Función para filtrar productos con stock bajo
function filtrarProductosStockBajo() {
    const rows = document.querySelectorAll('#productosTabla tr');
    
    rows.forEach(row => {
        const stockActual = parseFloat(row.cells[5]?.textContent) || 0;
        const stockMinimo = parseFloat(row.cells[6]?.textContent) || 0;
        
        if (stockMinimo > 0 && stockActual <= stockMinimo) {
            row.style.display = '';
            row.classList.add('table-warning');
        } else {
            row.style.display = 'none';
        }
    });
    
    // Agregar botón para mostrar todos
    const buscarContainer = document.querySelector('.search-box').parentElement;
    if (!document.getElementById('mostrarTodos')) {
        const btnMostrarTodos = document.createElement('button');
        btnMostrarTodos.id = 'mostrarTodos';
        btnMostrarTodos.className = 'btn btn-outline-secondary ms-2';
        btnMostrarTodos.innerHTML = '<i class="bi bi-arrow-clockwise me-1"></i>Mostrar todos';
        btnMostrarTodos.onclick = function() {
            document.querySelectorAll('#productosTabla tr').forEach(row => {
                row.style.display = '';
                row.classList.remove('table-warning');
            });
            this.remove();
        };
        buscarContainer.appendChild(btnMostrarTodos);
    }
}