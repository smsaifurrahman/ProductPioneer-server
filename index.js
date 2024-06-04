/** @format */

const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config();
const jwt = require("jsonwebtoken");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const { MongoClient, ServerApiVersion, Timestamp, ObjectId } = require("mongodb");
const port = process.env.PORT || 5000;

//Middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.fjovpu5.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
// const uri = "mongodb+srv://<username>:<password>@cluster0.fjovpu5.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
   serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
   },
});

async function run() {
   try {
      // Connect the client to the server	(optional starting in v4.7)
      await client.connect();

      const userCollection = client.db("productPioneerDB").collection("users");
      const productCollection = client.db("productPioneerDB").collection("products");

      //middlewares verify token
      const verifyToken = (req, res, next) => {
         //   console.log( 'inside verify token', req.headers.authorization);
         if (!req.headers.authorization) {
            return res.status(401).send({ message: "forbidden access" });
         }

         const token = req.headers.authorization.split(" ")[1];
         jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
            if (err) {
               return res.status(401).send({ message: "forbidden access" });
            }
            req.decoded = decoded;
            //  console.log(req.decoded);
            next();
         });
      };

      // verify admin middleware
      const verifyAdmin = async (req, res, next) => {
         const email = req.decoded.email;

         const query = { email: email };
         const user = await userCollection.findOne(query);

         const isAdmin = user?.role === "admin";
         if (!isAdmin) {
            return res.status(403).send({ message: "forbidden access" });
         }
         next();
      };

      // jwt related APIs
      app.post("/jwt", async (req, res) => {
         const user = req.body;
         const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
            expiresIn: "1hr",
         });
         // console.log('from jwt', token);
         res.send({ token });
      });

      //users related api
      // add user in db
      app.post("/users", async (req, res) => {
         const user = req.body;
      
         const query = { email: user.email };
         const existingUser = await userCollection.findOne(query);
         if (existingUser) {
            return res.send({
               message: "User already exits",
               insertedId: null,
            });
         }
         const result = await userCollection.insertOne(user);
         res.send(result);
      });

      // get all users from db
      app.get("/users", verifyToken, verifyAdmin, async (req, res) => {
         const result = await userCollection.find().toArray();
         res.send(result);
      });

      // update a user role

      app.patch("/users/update/:email", async (req, res) => {
         const email = req.params.email;

         const userRole = req.body;
    
         const query = { email };
         const updateDoc = {
            $set: { ...userRole },
         };
         const result = await userCollection.updateOne(query, updateDoc);
         res.send(result);
      });

      // update a user's membership status 

      app.patch("/users/update-membership/:email", async (req, res) => {
         const email = req.params.email;
         console.log(email);
         const membershipStatus = req.body;
         console.log(membershipStatus);
         const query = { email };
         const updateDoc = {
            $set: { ...membershipStatus },
         };
         const result = await userCollection.updateOne(query, updateDoc);
         res.send(result);
      });

      //delete a user
      app.delete('/users/:email', async(req,res)=> {
         const email = req.params.email;
         const query = {email};
         const result = await userCollection.deleteOne(query);
         res.send(result)
      })


      // get a user info by email from db
      app.get("/user/:email", verifyToken, async (req, res) => {  
         const email = req.params.email;
         const result = await userCollection.findOne({ email });
         res.send(result);
      });


      // Product apis
      // add a product
      app.post("/products", async (req, res) => {
         const product = req.body;
         const productData = {...product,timestamp: Date.now()}
         // console.log(productData);
         const result = await productCollection.insertOne(productData);
         // console.log(result);
         res.send(result);
      });

      // get all products for a single user
      app.get("/products/:email", verifyToken ,async (req, res) => {
         const email = req.decoded.email;
         const query = {'productOwner.email': email};
         // console.log(query);
         const result = await productCollection.find(query).toArray();
         // console.log(result);
         res.send(result);
      });

      // get a single product

      app.get('/product/:id', async(req,res)=> {
         const id = req.params.id;
        
         const query = {_id: new ObjectId(id)};
        
         const result = await productCollection.findOne(query);
     
         res.send(result)
      });

      // update a product
      app.patch("/products/:id", async (req, res) => {
         const id = req.params.id;
         console.log(id);
         const updatedProduct = req.body;
         console.log(updatedProduct);
         const query = { _id: new ObjectId(id) };
         const updateDoc = {
            $set: { ...updatedProduct },
         };
         const result = await productCollection.updateOne(query, updateDoc);
         res.send(result);
      });




      //  //create-payment-intent
      app.post("/create-payment-intent", verifyToken, async (req, res) => {
         const price = req.body.price;
         const priceInCent = parseFloat(price) * 100;
         if (!price || priceInCent < 1) return;
         // generate clientSecret
         const { client_secret } = await stripe.paymentIntents.create({
            amount: priceInCent,
            currency: "usd",
            // In the latest version of the API, specifying the `automatic_payment_methods` parameter is optional because Stripe enables its functionality by default.
            automatic_payment_methods: {
               enabled: true,
            },
         });

         //send client secret as response
         res.send({ clientSecret: client_secret });
      });


      // Send a ping to confirm a successful connection
      await client.db("admin").command({ ping: 1 });
      console.log(
         "Pinged your deployment. You successfully connected to MongoDB!"
      );
   } finally {
      // Ensures that the client will close when you finish/error
      // await client.close();
   }
}
run().catch(console.dir);

app.get("/", (req, res) => {
   res.send("Product Pioneer is working");
});

app.listen(port, () => {
   console.log(`Product Pioneer is sitting on port ${port}`);
});
