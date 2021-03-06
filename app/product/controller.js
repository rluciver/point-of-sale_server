const fs = require("fs");
const path = require("path");

const Product = require("./model");
const Category = require("../category/model");
const config = require("../config");

const { policyFor } = require("../policy");

async function bestSeller(req, res, next) {
  try {
    let product = await Product.find()
      .sort({ goods_sold: "-1" })
      .populate("category")
      .populate("variant")
      .populate("discount");

    let productFilter = product.filter((product) => product.goods_sold > 0);
    return res.json({
      message: "succes",
      data: productFilter,
    });
  } catch (error) {
    next(error);
  }
}

//Pembatasan Akses hanya untuk admin
async function store(req, res, next) {
  try {
    let policy = policyFor(req.user);
    if (!policy.can("manage", "all")) {
      return res.json({
        error: 1,
        message: "Anda Tidak meiliki akses untuk menambahkan Produk",
      });
    }

    let payload = req.body;

    if (req.file) {
      let tmp_path = req.file.path;
      let originalExt = req.file.originalname.split(".")[
        req.file.originalname.split(".").length - 1
      ];
      let filename = req.file.filename + "." + originalExt;
      let target_path = path.resolve(
        config.rootPath,
        `public/upload/${filename}`
      );

      const src = fs.createReadStream(tmp_path);
      const dest = fs.createWriteStream(target_path);
      src.pipe(dest);

      src.on("end", async () => {
        let product = new Product({ ...payload, image_url: filename });
        await product.save();
        return res.json({ message: "succes", data: product });
      });

      src.on("error", async () => {
        next(error);
      });
    } else {
      let product = new Product(payload);
      await product.save();
      return res.json({ message: "succes", data: product });
    }
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

//validation Wajib Login
async function index(req, res, next) {
  try {
    let {
      limit = 10,
      skip = 0,
      q = "",
      category = "",
      sort = "",
      time = "",
    } = req.query;
    let criteria = {};
    if (q.length) {
      criteria = { ...criteria, name: { $regex: `${q}`, $options: "i" } };
    }
    if (category.length) {
      category = await Category.findOne({
        name: { $regex: `${category}`, $options: "i" },
      });
      if (category) {
        criteria = { ...criteria, category: category._id };
      }
    }
    if (sort === "-1" || sort === "1") {
      sort = { name: sort };
    } else {
      sort = { createdAt: time };
    }
    let products = await Product.find(criteria)
      .sort(sort)
      .limit(parseInt(limit))
      .skip(parseInt(skip))
      .populate("category")
      .populate("variant")
      .populate("discount");

    let count = await Product.countDocuments(criteria);
    return res.json({ message: "succes", data: products, count });
  } catch (error) {
    next(error);
  }
}

//validation Wajib Login
async function singgleProduct(req, res, next) {
  try {
    let id = req.params.id;
    let products = await Product.findOne({ _id: id })
      .populate("category")
      .populate("variant")
      .populate("discount");
    return res.json({ message: "succes", data: products });
  } catch (error) {
    next(error);
  }
}

//Pembatasan Akses hanya untuk admin
async function update(req, res, next) {
  try {
    let policy = policyFor(req.user);
    if (!policy.can("manage", "all")) {
      return res.json({
        error: 1,
        message: "Anda Tidak Memiliki Akses untuk Merubah Product",
      });
    }

    let payload = req.body;
    if (req.file) {
      let tmp_path = req.file.path;
      let originalExt = req.file.originalname.split(".")[
        req.file.originalname.split(".").length - 1
      ];
      let filename = req.file.filename + "." + originalExt;
      let target_path = path.resolve(
        config.rootPath,
        `public/upload/${filename}`
      );

      const src = fs.createReadStream(tmp_path);
      const dest = fs.createWriteStream(target_path);
      src.pipe(dest);

      src.on("end", async () => {
        let product = await Product.findOne({ _id: req.params.id });
        let currentImage = `${config.rootPath}/public/upload/${product.image_url}`;
        if (fs.existsSync(currentImage)) {
          fs.unlinkSync(currentImage);
        }
        product = await Product.findOneAndUpdate(
          { _id: req.params.id },
          { ...payload, image_url: filename },
          { new: true, runValidators: true }
        )
          .populate("category")
          .populate("variant")
          .populate("discount");

        return res.json({ message: "succes", data: product });
      });

      src.on("error", async () => {
        next(error);
      });
    } else {
      let product = await Product.findOneAndUpdate(
        { _id: req.params.id },
        payload,
        { new: true, runValidators: true }
      )
        .populate("category")
        .populate("variant")
        .populate("discount");
      return res.json({ message: "succes", data: product });
    }
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

//Pembatasan Akses hanya untuk admin
async function destroy(req, res, next) {
  try {
    let policy = policyFor(req.user);
    if (!policy.can("manage", "all")) {
      return res.json({
        error: 1,
        message: "Anda Tidak Memiliki Akses Untuk Menghapus Produk",
      });
    }

    let product = await Product.findOneAndDelete({ _id: req.params.id })
      .populate("category")
      .populate("variant")
      .populate("discount");
    let currentImage = `${config.rootPath}/public/upload/${product.image_url}`;

    if (fs.existsSync(currentImage)) {
      fs.unlinkSync(currentImage);
    }
    return res.json({ message: "succes", data: product });
  } catch (error) {
    next(error);
  }
}
module.exports = { store, index, update, destroy, singgleProduct, bestSeller };
