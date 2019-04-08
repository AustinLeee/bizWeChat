const EntitySchema = require("typeorm").EntitySchema; 
const Customer = require("../model/Customer").Customer; 

module.exports = new EntitySchema({
    name: "Customer",
    target: Customer,
    columns: {
        id: {
            primary: true,
            type: "int",
            generated: true
        },
        insert_time: {
            type: "timestamp"
        },
        modify_time: {
            type: "timestamp"
        },
        status: {
            type: "int"
        },
        name: {
            type: "varchar"
        },
        phone_number: {
            type: "varchar"
        },
        sign_up_time: {
            type: "timestamp"
        },
        we_chatid: {
            type: "varchar"
        },
        base_school_id: {
            type: "int"
        }
    }
});