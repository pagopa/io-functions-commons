import {Request, Response } from "express-serve-static-core";
import {createAppVersionHeaderMiddleware } from "../express"
import {Request as MockRequest } from 'jest-express/lib/request';
import {Response as MockResponse } from 'jest-express/lib/response';

let request: MockRequest;
let response: MockResponse;

describe("createAppVersionHeaderHandler", () => {
    beforeEach(() => {
        request = new MockRequest("");
        response = new MockResponse();
    });
    afterEach(() => {
        request.resetMocked();
        response.resetMocked();
    });
    process.cwd = () => "/dev/null";
    
    it("should respond with a function setting the version header on the response", () => {
        const old_npm_package_version = process.env.npm_package_version;
        process.env.npm_package_version = "1.0.0";


        createAppVersionHeaderMiddleware()(request as unknown as Request, response as unknown as Response, ()=>{});
        expect(response.getHeader("X-API-Version")).toBe("1.0.0");

        process.env.npm_package_version = old_npm_package_version;
    });

});