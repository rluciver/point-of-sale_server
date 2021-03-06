const Product = require("../product/model");
const Cart = require("./model");

async function index(req, res, next) {
  try {
    let cart = await Cart.find({ user: req.user }).populate("product");
    return res.json({ message: "succes", data: cart });
  } catch (error) {
    next(error);
  }
}

async function cart(req, res, next) {
  try {
    let { items } = req.body;
    const productId = items.map((itm) => itm._id);
    const products = await Product.find({ _id: { $in: productId } })
      .populate("variant")
      .populate("discount");

    let cartItems = items.map((item) => {
      let realtedProduct = products.find(
        (product) => product._id.toString() === item._id
      );
      let discount = {
        name: realtedProduct.discount ? realtedProduct.discount.name : "",
        type: realtedProduct.discount ? realtedProduct.discount.type : "",
        value: realtedProduct.discount ? realtedProduct.discount.value : "",
      };
      let variant = {
        name: item.variantName,
        option: item.variantOption,
        stock: item.variantStock,
      };
      return {
        idVariantOption: item.idVariantOption,
        categoryName: item.categoryName,
        product: realtedProduct._id,
        price: realtedProduct.price,
        image_url: realtedProduct.image_url,
        name: realtedProduct.name,
        user: req.user._id,
        qty: item.qty,
        discount,
        variant,
      };
    });

    await Cart.bulkWrite(
      cartItems.map((item) => {
        return {
          updateMany: {
            filter: {
              user: req.user._id,
              idVariantOption: item.idVariantOption,
            },
            update: item,
            upsert: true,
          },
        };
      })
    );

    return res.json({ message: "succes", data: cartItems });
  } catch (error) {
    if (error && error.name === "ValidationError") {
      return res.json({
        error: 1,
        message: error.message,
        fields: error.errors,
      });
    }
    next(error);
  }
}

module.exports = { index, cart };
