import express from "express";
import axios from "axios";
import FormData from "form-data";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config(); 
const app = express();
const PORT = 3000;
app.use(express.json());


app.get("/", (req, res) => {
    res.send("Hello, World");
});

// generate an image
app.post("/generate-image", async (req, res) => {
    try {
        // Extract parameters from the request body
        const {
            prompt,
            negative_prompt,
            aspect_ratio = "1:1",
            seed = 0,
            style_preset,
            output_format = "png"
        } = req.body;

        // Create the payload for the API request
        const payload = {
            prompt,
            negative_prompt,
            aspect_ratio,
            seed,
            style_preset,
            output_format,
        };

        // Send a request to the Stability AI API
        const response = await axios.postForm(
            `https://api.stability.ai/v2beta/stable-image/generate/core`,
            axios.toFormData(payload, new FormData()),
            {
                validateStatus: undefined,
                responseType: "arraybuffer", // Expecting image bytes
                headers: {
                    Authorization: `Bearer ${process.env.STABILITY_API_KEY}`,
                    Accept: "image/*",
                },
            }
        );

        if (response.status === 200) {
            // Generate a unique filename for the image
            const imgId = response.request - id;
            const filename = `${imgId}.${output_format}`;
            fs.writeFileSync(/images/filename, Buffer.from(response.data));

            // Respond with the file URL
            res.status(200).json({ success: true, file: filename });
        } else {
            // Handle API errors
            res.status(response.status).json({
                success: false,
                error: response.data.toString(),
            });
        }
    } catch (error) {
        console.error("Error generating image:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// upscaling image
app.post("/upscale-image", async (req, res) => {
    try {
         const { generation_id } = req.body;

        if (!generation_id) {
            return res.status(400).json({ success: false, error: "Missing generation_id." });
        }

         const response = await axios.get(
            `https://api.stability.ai/v2beta/results/${generation_id}`,
            {
                headers: {
                    accept: "image/*", // Expecting image data
                    authorization: `Bearer ${process.env.STABILITY_API_KEY}`
                },
                responseType: "arraybuffer", // Expect image bytes
                validateStatus: undefined
            }
        );

        if (response.status === 202) {
            // Generation still in progress
            return res.status(202).json({ success: false, message: "Generation in progress. Please try again later." });
        } else if (response.status === 200) {
             const filename = `upscaled-${generation_id}.webp`;
            const filePath = `images/${filename}`;
            fs.writeFileSync(filePath, Buffer.from(response.data));

            // Return the file URL to the client
            return res.status(200).json({ success: true, file: filePath });
        } else {
            // Handle other errors
            return res.status(response.status).json({ success: false, error: response.data.toString() });
        }
    } catch (error) {
        console.error("Error upscaling image:", error);
        return res.status(500).json({ success: false, error: error.message });
    }
});


// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
