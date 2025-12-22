import { createProduct as createProductService } from '../services/productService.js';

export const createProduct = async (req, res) => {
  try {
    const productData = req.body;
    const processedProduct = await createProductService(productData);
    
    if (!processedProduct.productFound) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
        data: {
          product: {
            ean: processedProduct.ean,
            quantity: processedProduct.quantity,
            buy_price: processedProduct.buy_price,
            currency: processedProduct.currency,
            supplier_region: processedProduct.supplier_region,
          },
          amazonCatalog: null,
        },
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Product Added Successfully',
      data: {
        product: {
          ean: processedProduct.ean,
          quantity: processedProduct.quantity,
          buy_price: processedProduct.buy_price,
          currency: processedProduct.currency,
          supplier_region: processedProduct.supplier_region,
        },
        amazonCatalog: processedProduct.amazonCatalog || null,
      },
    });
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing product',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

