import React from "react";
import Input from "../../../core/ui/components/Input";

const PurchaseRequestForm = ({ payload, onPayloadChange }) => {
  const handleChange = (e) => {
    onPayloadChange({
      ...payload,
      [e.target.name]: e.target.value,
    });
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Input
        label="Producto/Servicio"
        name="product_service"
        value={payload.product_service || ""}
        onChange={handleChange}
        placeholder="Ej: Laptop Dell XPS 15"
        required
      />
      <Input
        label="Cantidad"
        name="quantity"
        type="number"
        value={payload.quantity || ""}
        onChange={handleChange}
        placeholder="1"
        required
      />
      <Input
        label="Proveedor"
        name="supplier"
        value={payload.supplier || ""}
        onChange={handleChange}
        placeholder="Ej: Amazon"
      />
      <Input
        label="Precio Total Estimado"
        name="estimated_total_price"
        type="number"
        value={payload.estimated_total_price || ""}
        onChange={handleChange}
        placeholder="1500"
        required
      />
    </div>
  );
};

export default PurchaseRequestForm;
