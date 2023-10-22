action({
    author: 'noellealarie',
    name: 'Framed Avatar Maker',
    description: 'Creates an avatar in a round frame, with transparent background',
    ui: (form) => ({
        portrait_positive: form.string({ label: 'Portrait Positive', default: '', textarea: true }),
        frame_positive: form.string({ label: 'Frame Positive', default: '', textarea: true }),
        negative: form.string({ label: 'Negative', default: '', textarea: true }),
        cuttoffs: form.list({
            label: 'Cutoff',
            element: () =>
                form.group({
                    layout: 'H',
                    items: () => ({
                        region_text: form.str({ label: 'Region Text', textarea: true }),
                        target_text: form.str({ label: 'Target Text' }),
                        weight: form.float({ label: 'Weight', default: 1 }),
                    }),
                }),
        }),
        resolution: form.group({
            label: 'Resolution',
            items: () => ({
                portrait_w_x_h: form.selectOne({
                    label: 'Width x Height',
                    choices: [
                        { type: '1024x1024' },
                        { type: '896x1152' },
                        { type: '832x1216' },
                        { type: '768x1344' },
                        { type: '640x1536' },
                    ],
                }),
                /* portrait_width: form.int({ label: 'Portrait Width', default: 832 }),
                portrait_height: form.int({ label: 'Portrait Height', default: 1216 }), */
                frame_diameter: form.int({ label: 'Frame Diameter', default: 1024 }),
                frame_thickness: form.int({ label: 'Frame Thickness', default: 130 }),
            }),
        }),

        model: form.enum({
            label: 'Checkpoint',
            enumName: 'Enum_CheckpointLoaderSimple_ckpt_name',
        }),

        seed: form.intOpt({ label: 'Seed', default: 1066555182004313 }),

        clip_skip: form.intOpt({ label: 'Clip Skip', default: 2 }),

        steps: form.int({
            default: 30,
            label: 'Steps',
            min: 0,
            group: 'KSampler',
        }),

        cfg: form.float({
            label: 'CFG',
            default: 5.0,
            group: 'KSampler',
        }),

        sampler: form.enum({
            label: 'Sampler',
            enumName: 'Enum_KSampler_sampler_name',
            default: 'dpmpp_2m_sde_gpu',
            group: 'KSampler',
        }),

        scheduler: form.enum({
            label: 'Scheduler',
            enumName: 'Enum_KSampler_scheduler',
            default: 'karras',
            group: 'KSampler',
        }),

        freeu: form.groupOpt({
            label: 'FreeU',
            items: () => ({
                b1: form.float({ default: 1.1, group: 'FreeU' }),
                b2: form.float({ default: 1.15, group: 'FreeU' }),
                s1: form.float({ default: 0.85, group: 'FreeU' }),
                s2: form.float({ default: 0.35, group: 'FreeU' }),
            }),
        }),

        save: form.groupOpt({
            label: 'Save Image',
            items: () => ({
                save_frame: form.bool({ label: 'Save Frame Image', default: false }),
                save_portrait: form.bool({ label: 'Save Portrait Image', default: false }),
                directory: form.str({ label: 'Output Directory', default: 'avatars' }),
                delimiter: form.str({ label: 'Delimiter', default: '_' }),
                date: form.bool({
                    label: 'Add Date',
                    tooltip: 'Adds date to the name of the image (YYYYMMDD)',
                    default: false,
                }),
                ckpt: form.bool({
                    label: 'Add Checkpoint',
                    tooltip: 'Adds name of the checkpoint to the name of the image',
                    default: false,
                }),
                embed: form.bool({
                    label: 'Embed Workflow',
                    tooltip: 'Embed the workflow to the image',
                    default: false,
                }),
            }),
        }),
    }),

    run: async (flow, p) => {
        const graph = flow.nodes
        const { steps, cfg, sampler, scheduler } = p
        const portrait_width = Number(p.resolution.portrait_w_x_h.type.split('x')[0])
        const portrait_height = Number(p.resolution.portrait_w_x_h.type.split('x')[1])
        flow.print(`Portrait Width: ${portrait_width}\nPortrait Height: ${portrait_height}`)

        const frame_width = p.resolution.frame_diameter
        const frame_height = p.resolution.frame_diameter
        const frame_thickness = p.resolution.frame_thickness

        let portrait_positive: _CONDITIONING // Declare portrait_positive here
        let negative: _CONDITIONING // Declare negative here
        let frame_positive: _CONDITIONING // Declare frame_positive here

        const container_image = graph.ImageContainer({
            width: frame_width,
            height: frame_height,
            red: 255,
            green: 255,
            blue: 255,
            alpha: 1,
        })

        const frame_image = graph.ImageDrawEllipseByContainer({
            container: container_image,
            start_x: 0,
            start_y: 0,
            end_x: 1,
            end_y: 1,
            outline_size: frame_thickness,
            outline_red: 255,
            outline_green: 255,
            outline_blue: 255,
            outline_alpha: 1,
            fill_red: 0,
            fill_green: 0,
            fill_blue: 0,
            fill_alpha: 0,
            SSAA: 16,
            method: 'lanczos',
        })

        const inner_circle_image = graph.ImageDrawEllipseByContainer({
            container: container_image,
            start_x: 0,
            start_y: 0,
            end_x: 1,
            end_y: 1,
            outline_size: frame_thickness,
            outline_red: 0,
            outline_green: 0,
            outline_blue: 0,
            outline_alpha: 0,
            fill_red: 255,
            fill_green: 255,
            fill_blue: 255,
            fill_alpha: 1,
            SSAA: 16,
            method: 'lanczos',
        })

        const half_container_image = graph.ImageDrawRectangleByContainer({
            container: container_image,
            start_x: 0,
            start_y: 0,
            end_x: 1,
            end_y: 0.5,
            outline_size: 0,
            outline_alpha: 0,
            fill_red: 255,
            fill_green: 255,
            fill_blue: 255,
            fill_alpha: 1,
            SSAA: 4,
            method: 'lanczos',
        })

        const frame_mask = graph.ImageToMask({ image: frame_image, channel: 'alpha' })
        const inner_circle_mask = graph.ImageToMask({ image: inner_circle_image, channel: 'alpha' })
        const full_circle_mask = graph.AddMask({ mask1: inner_circle_mask, mask2: frame_mask })
        const outside_mask = graph.InvertMask({ mask: full_circle_mask })
        const half_container_mask = graph.ImageToMask({ image: half_container_image, channel: 'alpha' })
        const frame_outside_mask = graph.AddMask({ mask1: outside_mask, mask2: frame_mask })
        const half_frame_outside_mask = graph.SubtractMask({ mask1: frame_outside_mask, mask2: half_container_mask })

        const ckpt = graph.CheckpointLoaderSimple({ ckpt_name: p.model })
        const seed = p.seed == null ? flow.randomSeed() : p.seed
        const clip =
            p.clip_skip == null
                ? ckpt._CLIP
                : graph.CLIPSetLastLayer({ clip: ckpt._CLIP, stop_at_clip_layer: -Math.abs(p.clip_skip) })
        const vae = ckpt._VAE

        const model = p.freeu
            ? graph.FreeU({
                  model: ckpt,
                  b1: p.freeu.b1,
                  b2: p.freeu.b2,
                  s1: p.freeu.s1,
                  s2: p.freeu.s2,
              })
            : ckpt

        if (p.cuttoffs.length > 0) {
            const cutoff_regions = p.cuttoffs

            let cutoff_region: _CLIPREGION = graph.BNK$_CutoffBasePrompt({
                clip: clip,
                text: p.portrait_positive,
            })

            cutoff_regions.forEach((region, index) => {
                cutoff_region = graph.BNK$_CutoffSetRegions({
                    clip_regions: cutoff_region,
                    region_text: region.region_text,
                    target_text: region.target_text,
                    weight: region.weight,
                })
            })

            portrait_positive = graph.BNK$_CutoffRegionsToConditioning({ clip_regions: cutoff_region })
        } else {
            portrait_positive = graph.CLIPTextEncode({ clip: clip, text: p.portrait_positive })
        }

        frame_positive = graph.CLIPTextEncode({ clip: clip, text: p.frame_positive })

        negative = graph.CLIPTextEncode({ clip: clip, text: p.negative })

        let portrait_start_latent = graph.KSampler({
            model: model,
            latent_image: graph.EmptyLatentImage({
                batch_size: 1,
                height: portrait_height,
                width: portrait_width,
            }),
            positive: portrait_positive,
            negative: negative,
            sampler_name: sampler,
            scheduler: scheduler,
            denoise: 1,
            steps: steps,
            cfg: cfg,
        })

        let frame_start_latent = graph.KSampler({
            seed: seed,
            latent_image: graph.SetLatentNoiseMask({
                samples: graph.EmptyLatentImage({
                    batch_size: 1,
                    width: frame_width,
                    height: frame_height,
                }),
                mask: frame_mask,
            }),
            model,
            positive: frame_positive,
            negative: negative,
            sampler_name: sampler,
            scheduler: scheduler,
            denoise: 1,
            steps: steps,
            cfg: cfg,
        })

        const portrait_squared_image = graph.ImageTransformResizeAbsolute({
            images: graph.ImageTransformPaddingAbsolute({
                images: graph.VAEDecode({ samples: portrait_start_latent, vae: vae }),
                add_width: 0,
                add_height: (portrait_height - portrait_width) / 2,
                method: 'constant',
            }),
            width: frame_width,
            height: frame_height,
            method: 'lanczos',
        })

        let portrait_segmented = graph.ImageSegmentation({
            images: portrait_squared_image,
            model: 'u2net_human_seg',
            alpha_matting: 'true',
            alpha_matting_background_threshold: 100,
            alpha_matting_foreground_threshold: 200,
            alpha_matting_erode_size: 0,
            post_process_mask: 'true',
        })

        const portrait_mask = graph.SubtractMask({
            mask1: graph.ImageToMask({
                image: portrait_segmented,
                channel: 'alpha',
            }),
            mask2: half_frame_outside_mask,
        })

        const portrait_image_alpha = graph.AlphaChanelAddByMask({
            images: graph.Images_to_RGB({ images: portrait_squared_image }),
            mask: graph.InvertMask({ mask: portrait_mask }),
            method: 'default',
        })

        const frame_image_alpha = graph.AlphaChanelAddByMask({
            images: graph.Images_to_RGB({ images: graph.VAEDecode({ samples: frame_start_latent, vae: vae }) }),
            mask: graph.InvertMask({
                mask: frame_mask,
            }),
            method: 'default',
        })

        let mask_for_composite = graph.AddMask({ mask1: frame_mask, mask2: portrait_mask })

        const final_image = graph.ImageCompositeAbsoluteByContainer({
            container: container_image,
            images_a: frame_image_alpha,
            images_b: portrait_image_alpha,
            images_a_x: 0,
            images_a_y: 0,
            images_b_x: 0,
            images_b_y: 0,
            background: 'images_a',
            method: 'pair',
        })

        if (p.save) {
            let filename_prefix = ''
            const date = new Date()

            let currentDay = String(date.getDate()).padStart(2, '0')
            let currentMonth = String(date.getMonth() + 1).padStart(2, '0')
            let currentYear = date.getFullYear()
            let namedate = `${currentYear}${currentMonth}${currentDay}`
            let nameckpt = `${p.model.replace(/^(SDXL|SD1\.5)\\/, '')}`

            if (p.save.date) {
                filename_prefix += `${p.save.delimiter}${namedate}`
            }
            if (p.save.ckpt) {
                filename_prefix += `${p.save.delimiter}${nameckpt}`
            }

            let avatar_filename = `avatar${filename_prefix}`
            let portrait_filename = `portrait${filename_prefix}`
            let frame_filename = `frame${filename_prefix}`

            if (p.save.save_frame) {
                graph.Image_Save({
                    images: frame_image_alpha,
                    filename_prefix: frame_filename,
                    output_path: p.save.directory,
                    filename_delimiter: p.save.delimiter,
                    filename_number_padding: 1,
                    filename_number_start: 'false',
                    extension: 'png',
                    quality: 100,
                    lossless_webp: 'false',
                    overwrite_mode: 'false',
                    show_history: 'false',
                    show_history_by_prefix: 'false',
                    embed_workflow: p.save.embed ? 'true' : 'false',
                    show_previews: 'true',
                })
            } else {
                graph.PreviewImage({ images: frame_image_alpha })
            }

            if (p.save.save_frame) {
                graph.Image_Save({
                    images: graph.VAEDecode({ samples: portrait_start_latent, vae: vae }),
                    filename_prefix: portrait_filename,
                    output_path: p.save.directory,
                    filename_delimiter: p.save.delimiter,
                    filename_number_padding: 1,
                    filename_number_start: 'false',
                    extension: 'png',
                    quality: 100,
                    lossless_webp: 'false',
                    overwrite_mode: 'false',
                    show_history: 'false',
                    show_history_by_prefix: 'false',
                    embed_workflow: p.save.embed ? 'true' : 'false',
                    show_previews: 'true',
                })
            } else {
                graph.PreviewImage({ images: graph.VAEDecode({ samples: portrait_start_latent, vae: vae }) })
            }

            graph.Image_Save({
                images: final_image,
                filename_prefix: avatar_filename,
                output_path: p.save.directory,
                filename_delimiter: p.save.delimiter,
                filename_number_padding: 1,
                filename_number_start: 'false',
                extension: 'png',
                quality: 100,
                lossless_webp: 'false',
                overwrite_mode: 'false',
                show_history: 'false',
                show_history_by_prefix: 'false',
                embed_workflow: p.save.embed ? 'true': 'false',
                show_previews: 'true',
            })
        } else {
            //graph.PreviewImage({ images: graph.VAEDecode({ samples: portrait_start_latent, vae: vae }) })
            //graph.PreviewImage({ images: frame_image_alpha })
            graph.PreviewImage({ images: final_image })
        }

        await flow.PROMPT()
    },
})
