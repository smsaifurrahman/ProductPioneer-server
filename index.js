const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config();
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion } = require('mongodb');
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
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const userCollection = client.db("productPioneerDB").collection("users");

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

    // jwt related APIs
    app.post('/jwt', async(req,res)=>{
        const user = req.body;
        const token = jwt.sign(user,process.env.ACCESS_TOKEN_SECRET,{
            expiresIn: '1hr',
        });
        // console.log('from jwt', token);
        res.send({token})
    });


    //users related api
    app.post('/users', async(req,res)=>{
        const user = req.body;
        console.log('from user',user);
        const query = {email: user.email};
        const existingUser = await userCollection.findOne(query);
        if(existingUser) {
            return res.send({
                message: 'User already exits',
                insertedId: null
            });
        }
        const result = await userCollection.insertOne(user);
        res.send(result);
    });





    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
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
