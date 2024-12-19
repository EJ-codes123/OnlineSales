import express from "express";
import axios from "axios";
import FormData from "form-data";
import fs from "fs";
import dotenv from "dotenv";
import fileUpload from "express-fileupload"; // Middleware for handling image uploads
import cors from "cors"; // Import cors middleware
import path from "path"; // Import 'path' module for resolving paths

dotenv.config();
const app = express();
const PORT = 3000;

// Middleware for parsing JSON and handling file uploads
app.use(express.json());
app.use(cors()); // Enable CORS for all routes by default
app.use(fileUpload());
const __dirname = path.resolve(); // Get current directory in ES module
app.use("/imagesGen", express.static(path.join(__dirname, "imagesGen")));

// Route: Server health check
app.get("/", (req, res) => {
    res.send("Hello, World");
});



// // generate an image

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
            const imgId = `generated-${Date.now()}`;
            const filename = `${imgId}.${output_format}`;

            // Resolve the path to the imagesGen folder
            const folderPath = path.join(__dirname, 'imagesGen');

            // Ensure the folder exists
            if (!fs.existsSync(folderPath)) {
                fs.mkdirSync(folderPath);
            }

            // Full path for the image
            const filePath = path.join(folderPath, filename);

            // Save the image to the folder
            fs.writeFileSync(filePath, Buffer.from(response.data));

            // Respond with the file URL
            res.status(200).json({ success: true, file: `/imagesGen/${filename}` });
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

// Route: Upscale an image
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
                    Accept: "image/*",
                    Authorization: `Bearer ${process.env.STABILITY_API_KEY}`,
                },
                responseType: "arraybuffer",
                validateStatus: undefined,
            }
        );

        if (response.status === 202) {
            return res.status(202).json({ success: false, message: "Generation in progress. Please try again later." });
        } else if (response.status === 200) {
            const filename = `upscaled-${generation_id}.webp`;
            const filePath = `images/${filename}`;
            fs.writeFileSync(filePath, Buffer.from(response.data));
            res.status(200).json({ success: true, file: filePath });
        } else {
            res.status(response.status).json({ success: false, error: response.data.toString() });
        }
    } catch (error) {
        console.error("Error upscaling image:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Route: Search and Replace
app.post("/search-and-replace", async (req, res) => {
    try {
        const { prompt, search_prompt, output_format = "webp" } = req.body;
        const imageFile = req.files?.image;

        if (!imageFile) {
            return res.status(400).json({ success: false, error: "Missing image file." });
        }

        const form = new FormData();
        form.append("image", imageFile.data, imageFile.name);
        form.append("prompt", prompt);
        form.append("search_prompt", search_prompt);
        form.append("output_format", output_format);

        const response = await axios.post(
            `https://api.stability.ai/v2beta/stable-image/edit/search-and-replace`,
            form,
            {
                headers: {
                    ...form.getHeaders(),
                    Authorization: `Bearer ${process.env.STABILITY_API_KEY}`,
                    Accept: "image/*",
                },
                responseType: "arraybuffer",
                validateStatus: undefined,
            }
        );

        if (response.status === 200) {
            const filename = `search-replace-${Date.now()}.${output_format}`;
            fs.writeFileSync(`images/${filename}`, Buffer.from(response.data));
            res.status(200).json({ success: true, file: `images/${filename}` });
        } else {
            res.status(response.status).json({ success: false, error: response.data.toString() });
        }
    } catch (error) {
        console.error("Error in search and replace:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Route: Sketch
app.post("/sketch", async (req, res) => {
    try {
        const { prompt, control_strength = 0.6, output_format = "webp" } = req.body;
        const imageFile = req.files?.image;

        if (!imageFile) {
            return res.status(400).json({ success: false, error: "Missing image file." });
        }

        const form = new FormData();
        form.append("image", imageFile.data, imageFile.name);
        form.append("prompt", prompt);
        form.append("control_strength", control_strength);
        form.append("output_format", output_format);

        const response = await axios.post(
            `https://api.stability.ai/v2beta/stable-image/control/sketch`,
            form,
            {
                headers: {
                    ...form.getHeaders(),
                    Authorization: `Bearer ${process.env.STABILITY_API_KEY}`,
                    Accept: "image/*",
                },
                responseType: "arraybuffer",
                validateStatus: undefined,
            }
        );

        if (response.status === 200) {
            const filename = `sketch-${Date.now()}.${output_format}`;
            fs.writeFileSync(`images/${filename}`, Buffer.from(response.data));
            res.status(200).json({ success: true, file: `images/${filename}` });
        } else {
            res.status(response.status).json({ success: false, error: response.data.toString() });
        }
    } catch (error) {
        console.error("Error in sketch processing:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Add routes for structure and style with the same pattern as above...

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
