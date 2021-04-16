import {Request, Response } from "express-serve-static-core";
import {createAppVersionHeaderHandler } from "../express"
import {Response as MockResponse } from 'jest-express/lib/response';
import {Request as MockRequest } from 'jest-express/lib/request';

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

    it("should respond with a function setting the version header on the response", () => {
        const old_npm_package_version = process.env.npm_package_version;
        process.env.npm_package_version = "1.0.0";

        createAppVersionHeaderHandler()(request as unknown as Request, response as unknown as Response, ()=>{});
        expect(response.getHeader("X-API-Version")).toBe("1.0.0");

        process.env.npm_package_version = old_npm_package_version;
    });

});