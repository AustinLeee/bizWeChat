var pg = require('pg');
var log4js = require('log4js');

//初始化日志
log4js.configure({
  appenders: { xeeyoungDatabase: { type: 'file', filename: 'xeeyoung.log' } },
  categories: { default: { appenders: ['xeeyoungDatabase'], level: 'all' } }
});
var logger = log4js.getLogger('xeeyoungDatabase');
 
// 数据库配置
let config = {
    host: 'postgres-p9oemhim.sql.tencentcdb.com',
    port: 13480,
    user: "projectqp",
    password: "J2PLZtnG",
    database: "postgres",
    // 扩展属性
    max: 20, // 连接池最大连接数
    idleTimeoutMillis: 3000, // 连接最大空闲时间 3s
}
let client = new pg.Pool(config);
 
let PG = function () {
    logger.info("准备数据库连接...");
	//console.log("准备数据库连接...");
};
 
// PG.prototype.getConnection = function () {
    // client.connect(function (err) {
    //     if (err) {
    //         return console.error('数据库链接失败:', err);
    //     }
    //     client.query('SELECT NOW() AS "theTime"', function (err, result) {
    //         if (err) {
    //             return console.error('error running query', err);
    //         }
    //         console.log("数据库连接成功...");
    //     });
    // });
// };
 
// 查询函数
//@param str    查询语句
//@param value  相关值
//@param cb     回调函数
let clientHelper = function (str, value, cb) {
    // console.log(`client.query(${str},${value}) `)
    client.connect(function (err,client, done) {
        if (err) {
            //return logger.error('数据库链接失败:', err);
			return console.log('数据库链接失败:', err);
        }
        client.query(str, value, function (err, result) {
            // console.log("result",result)
            if (err) {
                cb("error");
            } else {
                if (result.rows != undefined) {
                    cb(result.rows);
                } else {
                    cb();
                }
                done();
                logger.info("释放数据库连接...");
            }
        });
    });
}
 
// let clientHelper = function (str, value, cb) {
//     // console.log(`client.query(${str},${value}) `)
//     client.query(str, value, function (err, result) {
//         // console.log("result",result)
//         if (err) {
//             cb("error");
//         } else {
//             if (result.rows != undefined) {
//                 cb(result.rows);
//             } else {
//                 cb();
//             }
//         }
//     });
// }
 
//增加
//@param tablename 数据表名称
//@param fields 更新的字段和值，json格式
//@param cb 回调函数
//pgclient.insert('test',{"name":'xiaoming',"age" : "20"},cb);
PG.prototype.insert = function (tablename, fields, cb) {
    if (!tablename) return;
    let str = "INSERT INTO " + tablename + "(";//"insert into test("
    let field = [];
    let value = [];
    let num = [];
    let count = 0;
    for (let i in fields) {
        count++;
        field.push(i);//["name","age"]
        value.push(fields[i]);//["xiaoming","20"]
        num.push("$" + count);//[$1,$2]
    }
    str += field.join(",") + ") VALUES(" + num.join(",") + ")";// "insert into test(name,age) values($1,$2)"
    clientHelper(str, value, cb);//clientHelper("insert into test(name,age) values($1,$2)",["xiaoming","20"],cb)
    //RUN client.query("insert into test(name, age) values($1::varchar, $2::int)", ["xiaoming","20"])
};
 
//查询
//@param tablename      数据表名称              test
//@param fields         条件字段和值，json格式
//@param returnfields   返回字段                *
//@param cb             回调函数
//pgclient.select('test',{'name': 'xiaoming'},cb);
PG.prototype.select = function (tablename, fields, returnfields, cb) {
    if (!tablename) { return; }
 
    let returnStr = "";
    if (returnfields.length == 0) {
        returnStr = '*';
    } else {
        returnStr = fields.join(",");
    }
 
    let str = "Select " + returnStr + " FROM " + tablename + " WHERE ";//"Select * FROM test WHERE "
    let field = [];
    let value = [];
    let count = 0;
    for (let i in fields) {
        count++;
        field.push(i + "=$" + count);//[ name = $1 ]
        value.push(fields[i]);//[ 'xiaoming' ]
    }
    str += field.join(" and ");//"Select * FROM test WHERE name = $1"
    clientHelper(str, value, cb);//clientHelper("Select * FROM test WHERE name = $1", [ 'xiaoming' ], cb)
    //RUN => client.query("Select * FROM test WHERE name = $1", ["xiaoming"])
};
 
//修改
//@param tablename 数据表名称
//@param fields 更新的字段和值，json格式
//@param mainfields 条件字段和值，json格式
//pgclient.update('test'{"name":'xiaoming'},{"age" : "21"},,cb); 更新age
PG.prototype.update = function (tablename, mainfields, fields, cb) {
    if (!tablename) return;
    let str = "UPDATE " + tablename + " SET ";//"UPDATE test SET"
    let field = [];
    let value = [];
    let count = 0;
    for (let i in fields) {
        count++;
        field.push(i + "=$" + count);//["age=$1"]
        value.push(fields[i]);//["21"]
    }
    str += field.join(",") + " WHERE ";//"UPDATE test SET age=$1 WHERE"
    field = [];
    for (let j in mainfields) {
        count++;
        field.push(j + "=$" + count);//["name=$2"]
        value.push(mainfields[j]);//["21","xiaoming"]
    }
    str += field.join(" and ");//"UPDATE test SET age=$1 WHERE name=$2"
    clientHelper(str, value, cb);//clientHelper("UPDATE test SET age=$1 WHERE name=$2",["21","xiaoming"])
    //client.query("UPDATE test SET age=$1 WHERE name=$2", [21, "xiaoming"])
}
 
//删除
//@param tablename 数据表名称
//@param fields 条件字段和值，json格式
//@param cb 回调函数
//pgclient.delete("test",{"name","xiaoming"},cb)
PG.prototype.delete = function (tablename, fields, cb) {
    if (!tablename) return;
    let str = "DELETE FROM " + tablename + " WHERE ";//DELETE FROM test WHERE
    let field = [];
    let value = [];
    let count = 0;
    for (let i in fields) {
        count++;
        field.push(i + "=$" + count);//[name=$1]
        value.push(fields[i]);//["xiaoming"]
    }
    str += field.join(" and ");//DELETE FROM test WHERE name=$1
    clientHelper(str, value, cb);//clientHelper("DELETE FROM test WHERE name=$1", ["xiaoming"], cb)
    //client.query("DELETE FROM test WHERE name=$1", ["xiaoming"])})
}
 
module.exports = new PG();
