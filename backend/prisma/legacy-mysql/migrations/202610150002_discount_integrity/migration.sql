-- Preserve the database invariant while extending it for discounts.
ALTER TABLE `Order` DROP CHECK `order_totals`,
 ADD CONSTRAINT `order_totals` CHECK (
  subtotal > 0 AND deliveryFee >= 0 AND discount >= 0
  AND discount <= subtotal + deliveryFee
  AND total >= 0 AND total = subtotal + deliveryFee - discount
 );
