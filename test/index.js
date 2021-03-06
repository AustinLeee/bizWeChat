const typeorm = require("typeorm"); 
const Customer = require("../model/Customer").Customer; 

typeorm.createConnection({
    type: "mysql",
    host: "localhost",
    port: 3306,
    username: "test",
    password: "test",
    database: "test",
    synchronize: true,
    logging: false,
    entities: [
        require("./entity/PostSchema"),
        require("./entity/CategorySchema")
    ]
}).then(function (connection) {

    const category1 = new Category(0, "TypeScript");
    const category2 = new Category(0, "Programming");

    return connection
        .manager
        .save([category1, category2])
        .then(() => {

            let post = new Post();
            post.title = "Control flow based type analysis";
            post.text = "TypeScript 2.0 implements a control flow-based type analysis for local variables and parameters.";
            post.categories = [category1, category2];

            let postRepository = connection.getRepository(Post);
            postRepository.save(post)
                .then(function(savedPost) {
                    console.log("Post has been saved: ", savedPost);
                    console.log("Now lets load all posts: ");

                    return postRepository.find();
                })
                .then(function(allPosts) {
                    console.log("All posts: ", allPosts);
                });
        });

}).catch(function(error) {
    console.log("Error: ", error);
});