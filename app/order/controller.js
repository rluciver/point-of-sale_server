const moment = require("moment");
const mongoose = require("mongoose");
const { policyFor } = require("../policy");
const Order = require("./model");
const Cart = require("../cart/model");
const nodemailer = require("nodemailer");

async function index(req, res, next) {
  try {
    let policy = policyFor(req.user);
    if (!policy.can("manage", "all")) {
      return res.json({
        error: 1,
        message: "Anda Tidak Memiliki Akses Untuk Melihat History Order",
      });
    }
    let { limit = 10, skip = 0, date = "", nama_lengkap = "" } = req.query;
    let criteria = {};

    if (date.length) {
      criteria = {
        ...criteria,
        date: { $regex: `${date}`, $options: "i" },
      };
    }
    if (nama_lengkap.length) {
      criteria = {
        ...criteria,
        nama_lengkap: { $regex: `${nama_lengkap}`, $options: "i" },
      };
    }
    let dataOrder = await Order.find(criteria)
      .limit(parseInt(limit))
      .skip(parseInt(skip));
    let count = await Order.countDocuments(criteria);
    return res.json({ message: "succes", data: dataOrder, count });
  } catch (error) {
    next(error);
  }
}

async function creatOrder(req, res, next) {
  try {
    let policy = policyFor(req.user);
    if (!policy.can("create", "Order")) {
      return res.json({
        error: 1,
        message: "Anda Tidak Memiliki Akses Untuk Membuat Order",
      });
    }

    let { nama_lengkap, email } = req.body;
    let items = await Cart.find({ user: req.user._id })
      .populate("product")
      .populate("variant")
      .populate("category")
      .populate("discount");

    if (!items.length) {
      return res.json({
        error: 1,
        message: "Tidak Ditemukan Data Carts",
      });
    }

    let dataOrder = [];
    let dataAmount = [];
    let valueDiscount = 0;
    let valuePrice = 0;
    let valueQty = 0;
    let sigmaDiscount = 0;
    let valueAmount = 0;
    let sigmaAmount = 0;
    let faktur = [];
    let faktur_db = [];
    await Cart.find({ user: req.user._id }).then(async (dataCart) => {
      dataCart.map((itm) => {
        dataOrder.push(itm.product[0]);
        if (itm.discount.type === "%") {
          valueDiscount = parseInt(itm.discount.value);
          valuePrice = parseInt(itm.price);
          valueQty = parseInt(itm.qty);
          sigmaDiscount = (valueDiscount / 100) * valuePrice;
          valueAmount = (valuePrice - sigmaDiscount) * valueQty;
          dataAmount.push(valueAmount);
          faktur.push(
            `Product : ${itm.name} <br /> Discount : ${valueDiscount}% <br /> Price : ${valuePrice} <br /> Qty : ${valueQty} <br /> Total Discount : ${sigmaDiscount} <br /> Sub Total Belanja : ${valueAmount}`
          );
          faktur_db.push({
            Product: itm.name,
            Category_Name: itm.categoryName,
            Variant_Name: itm.variant.name,
            VariantOption: itm.variant.option,
            Qty: valueQty,
            Discount: valueDiscount + " %",
            Price: valuePrice,
            Total_Discount: sigmaDiscount,
            Sub_Total_Belanja: valueAmount,
          });
        } else if (itm.discount.type === "fixed") {
          valueDiscount = parseInt(itm.discount.value);
          valuePrice = parseInt(itm.price);
          valueQty = parseInt(itm.qty);
          sigmaDiscount = valueDiscount * valueQty;
          valueAmount = (valuePrice - valueDiscount) * valueQty;
          dataAmount.push(valueAmount);
          faktur.push(
            `Product : ${itm.name} <br /> Discount : ${valueDiscount} <br /> Price : ${valuePrice} <br /> Qty : ${valueQty} <br /> Total Discount : ${sigmaDiscount} <br /> Sub Total Belanja : ${valueAmount}`
          );
          faktur_db.push({
            Product: itm.name,
            Category_Name: itm.categoryName,
            Variant_Name: itm.variant.name,
            VariantOption: itm.variant.option,
            Qty: valueQty,
            Discount: valueDiscount,
            Price: valuePrice,
            Total_Discount: sigmaDiscount,
            Sub_Total_Belanja: valueAmount,
          });
        } else {
          valuePrice = parseInt(itm.price);
          valueQty = parseInt(itm.qty);
          valueAmount = valuePrice * valueQty;
          dataAmount.push(valueAmount);
          faktur.push(
            `Product : ${itm.name} <br /> Discount : - <br /> Price : ${valuePrice} <br /> Qty : ${valueQty} <br /> Total Discount : ${sigmaDiscount} <br /> Sub Total Belanja : ${valueAmount}`
          );
          faktur_db.push({
            Product: itm.name,
            Category_Name: itm.categoryName,
            Variant_Name: itm.variant.name,
            VariantOption: itm.variant.option,
            Qty: valueQty,
            Discount: "-",
            Price: valuePrice,
            Total_Discount: sigmaDiscount,
            Sub_Total_Belanja: valueAmount,
          });
        }
      });
    });
    dataAmount.forEach((sum) => {
      sigmaAmount += sum;
    });
    let postOrder = new Order({
      _id: new mongoose.Types.ObjectId(),
      nama_lengkap,
      orders: faktur_db,
      amount: sigmaAmount,
      email,
      user: req.user._id,
      date: moment().format("YYYY-MM-DD"),
    });
    await postOrder.save();

    await Cart.find({ user: req.user._id }).then((data) => {
      data.map(async (itm) => {
        await Cart.findOneAndDelete({ user: itm.user });
      });
    });
    // izin pada gmail https://myaccount.google.com/lesssecureapps
    let transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      auth: {
        user: "critical.firdaus@gmail.com",
        pass: "Dausganteng12345",
      },
      tls: {
        rejectUnauthorized: false,
      },
    });
    let info = await transporter.sendMail({
      from: '"Point Of Sale" <critical.firdaus@gmail.com>',
      to: req.body.email,
      subject: "Invoice Pembelian",
      text: "Invoice Text",
      html: `<b>Detail Pembelian<b><br />${faktur} <br /> Grand Total Belanja : ${sigmaAmount}`,
    });

    console.log("Message sent: %s", info.messageId);
    console.log("Preview URL: %s", nodemailer.getTestMessageUrl(info));

    return res.json({ message: "succes", data: postOrder });
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

module.exports = { index, creatOrder };
